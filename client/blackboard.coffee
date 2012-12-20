NAVBAR_HEIGHT = 73 # keep in sync with @navbar-height in blackboard.less
SOUND_THRESHOLD_MS = 30*1000 # 30 seconds

blackboard = {} # store page global state

Meteor.startup ->
  blackboard.initialPageLoad = UTCNow()
  blackboard.newAnswerSound = new Audio "sound/that_was_easy.wav"
  # set up a persistent query so we can play the sound whenever we get a new
  # answer
  # note that this observe 'leaks' -- we're not seeing it up/tearing it
  # down with the blackboard page, we're going to play the sound whatever
  # page the user is currently on.  This is "fun".  Trust us...
  Meteor.subscribe 'newly-answered-puzzles'
  query = Puzzles.find $and: [ {answer: $ne: null}, {answer: $exists: true} ]
  query.observe
    added: (p, beforeIndex) ->
      # check the solved timestamp -- if it's within the last minute
      # (fudge factor), and the page isn't newly-loaded, play the sound.
      if p.solved and p.solved > (UTCNow() - SOUND_THRESHOLD_MS)
        if (UTCNow() - blackboard.initialPageLoad) > SOUND_THRESHOLD_MS
          unless Session.get 'mute'
            blackboard.newAnswerSound.play()

# Returns an event map that handles the "escape" and "return" keys and
# "blur" events on a text input (given by selector) and interprets them
# as "ok" or "cancel".
# (Borrowed from Meteor 'todos' example.)
okCancelEvents = (selector, callbacks) ->
  ok = callbacks.ok or (->)
  cancel = callbacks.cancel or (->)
  evspec = ("#{ev} #{selector}" for ev in ['keyup','keydown','focusout'])
  events = {}
  events[evspec.join(', ')] = (evt) ->
    if evt.type is "keydown" and evt.which is 27
      # escape = cancel
      cancel.call this, evt
    else if evt.type is "keyup" and evt.which is 13 or evt.type is "focusout"
      # blur/return/enter = ok/submit if non-empty
      value = String(evt.target.value or "")
      if value
        ok.call this, value, evt
      else
        cancel.call this, evt
  events

######### general properties of the blackboard page ###########
Template.blackboard.sortReverse = -> Session.get 'sortReverse'

############## groups, rounds, and puzzles ####################
Template.blackboard.roundgroups = ->
  dir = if Session.get 'sortReverse' then 'desc' else 'asc'
  RoundGroups.find {}, sort: [["created", dir]]
# the following is a map() instead of a direct find() to preserve order
Template.blackboard.rounds = ->
  r = ({
    round_num: 1+index+this.round_start
    round: Rounds.findOne(id) or { _id: id, name: Names.findOne(id)?.name }
    rX: "r#{1+index+this.round_start}"
   } for id, index in this.rounds)
   r.reverse() if Session.get 'sortReverse'
   return r
Template.blackboard.preserve ['#bb-sidebar']
Template.blackboard.created = ->
  this.afterFirstRender = ->
    $("#bb-sidebar").localScroll({ duration: 400, lazy: true })
    $("body").scrollspy(target: "#bb-sidebar", offset: (NAVBAR_HEIGHT + 10))
Template.blackboard.rendered = ->
  this.afterFirstRender?()
  this.afterFirstRender = null
  #  page title
  $("title").text("Blackboard")
  # update bootstrap "scroll spy" component when rounds list changes
  ss = $("body").data("scrollspy")
  ss.refresh()
  # hack to ensure first element is selected on first reload
  ss.activate(ss.targets[0]) if ss.targets.length
  ss.process()
  # affix side menu
  # XXX disabled because it doesn't play nice with narrow screens
  #$("#bb-sidebar > .bb-sidenav").affix()
  # tooltips
  $('#bb-sidebar .nav > li > a').tooltip placement: 'right'
  $('#bb-tables .bb-puzzle .puzzle-name > a').tooltip placement: 'left'
Template.blackboard.events
  "click .bb-sort-order button": (event, template) ->
     reverse = $(event.currentTarget).attr('data-sortReverse') is 'true'
     Session.set 'sortReverse', reverse or undefined
  "click .bb-canEdit .bb-editable": (event, template) ->
     edit = $(event.currentTarget).attr('data-bbedit')
     # note that we rely on 'blur' on old field (which triggers ok or cancel)
     # happening before 'click' on new field
     Session.set 'editing', edit
Template.blackboard.events okCancelEvents('.bb-editable input',
  ok: (text, evt) ->
     # find the data-bbedit specification for this field
     edit = $(evt.currentTarget).closest('*[data-bbedit]').attr('data-bbedit')
     [type, id, rest...] = edit.split('/')
     # strip leading/trailing whitespace from text (cancel if text is empty)
     text = text.replace /^\s+|\s+$/, ''
     processBlackboardEdit[type]?(text, id, rest...) if text
     Session.set 'editing', undefined # done editing this
  cancel: (evt) ->
     Session.set 'editing', undefined # not editing anything anymore
)
processBlackboardEdit =
  tags: (text, id, canon, field) ->
    processBlackboardEdit["tags_#{field}"]?(text, id, canon)
  puzzles: (text, id, field) ->
    processBlackboardEdit["puzzles_#{field}"]?(text, id)
  rounds: (text, id, field) ->
    processBlackboardEdit["rounds_#{field}"]?(text, id)
  roundgroups: (text, id, field) ->
    processBlackboardEdit["roundgroups_#{field}"]?(text, id)
  puzzles_title: (text, id) ->
    Meteor.call 'renamePuzzle', {id:id, name:text, who:Session.get('nick')}
  rounds_title: (text, id) ->
    Meteor.call 'renameRound', {id:id, name:text, who:Session.get('nick')}
  roundgroups_title: (text, id) ->
    Meteor.call 'renameRoundGroup', {id:id, name:text, who:Session.get('nick')}
  puzzles_answer: (text, id) ->
    # how to delete answer?
    Meteor.call 'setAnswer', id, text, Session.get('nick')
  tags_name: (text, id, canon) ->
    who = Session.get('nick')
    n = Names.findOne(id)
    tags = collection(n.type).findOne(id).tags
    t = (tag for tag in tags when tag.canon is canon)[0]
    Meteor.call 'setTag', n.type, id, text, t.value, who, (error,result) ->
      if (t.canon isnt canonical(text)) and (not error)
        Meteor.call 'deleteTag', n.type, id, t.name, who
  tags_value: (text, id, canon) ->
    n = Names.findOne(id)
    tags = collection(n.type).findOne(id).tags
    t = (tag for tag in tags when tag.canon is canon)[0]
    # special case for 'status' tag, which might not previously exist
    t = {name:'Status',canon:'status',value:''} if (canon is 'status') and not t
    # set tag (overwriting previous value)
    Meteor.call 'setTag', n.type, id, t.name, text, Session.get('nick')

Template.blackboard_round.hasPuzzles = -> (this.round?.puzzles?.length > 0)
# the following is a map() instead of a direct find() to preserve order
Template.blackboard_round.puzzles = ->
  ({
    round_num: this.round_num
    puzzle_num: 1 + index
    puzzle: Puzzles.findOne(id) or { _id: id }
    rXpY: "r#{this.round_num}p#{1+index}"
   } for id, index in this.round.puzzles)

Template.blackboard_puzzle.status = ->
  return (getTag this.puzzle, "status") or ""
Template.blackboard_puzzle.whos_working = ->
  return Presence.find
    room_name: ("puzzles/"+this.puzzle?._id)

Template.blackboard_puzzle.pretty_ts = (timestamp, brief) ->
  duration = (Session.get('currentTime') or UTCNow()) - timestamp
  seconds = Math.floor(duration/1000)
  return "in the future" if seconds < -60
  return "just now" if seconds < 60
  [minutes, seconds] = [Math.floor(seconds/60), seconds % 60]
  [hours,   minutes] = [Math.floor(minutes/60), minutes % 60]
  [days,    hours  ] = [Math.floor(hours  /24), hours   % 24]
  [weeks,   days   ] = [Math.floor(days   / 7), days    % 7]
  ago = (s) -> (s.replace(/^\s+/,'') + " ago")
  s = ""
  s += " #{weeks} week" if weeks > 0
  s += "s" if weeks > 1
  return ago(s) if s and brief
  s += " #{days} day" if days > 0
  s += "s" if days > 1
  return ago(s) if s and brief
  s += " #{hours} hour" if hours > 0
  s += "s" if hours > 1
  return ago(s) if s and brief
  s += " #{minutes} minute" if minutes > 0
  s += "s" if minutes > 1
  return ago(s)

# Subscribe to all group, round, and puzzle information
Meteor.autosubscribe ->
  return unless Session.equals("currentPage", "blackboard")
  Meteor.subscribe 'all-roundgroups'
  Meteor.subscribe 'all-rounds'
  Meteor.subscribe 'all-puzzles'
  # also subscribe to all presence information
  Meteor.subscribe 'all-presence'

# Update 'currentTime' every minute or so to allow pretty_ts to magically
# update
Meteor.startup ->
  Meteor.setInterval ->
    Session.set "currentTime", UTCNow()
  , 60*1000
