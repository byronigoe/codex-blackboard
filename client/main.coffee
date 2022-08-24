'use strict'

import md5 from 'md5'
import { gravatarUrl, nickHash } from './imports/nickEmail.coffee'
import abbrev from '../lib/imports/abbrev.coffee'
import canonical from '/lib/imports/canonical.coffee'
import { human_readable, abbrev as ctabbrev } from '../lib/imports/callin_types.coffee'
import { mechanics } from '../lib/imports/mechanics.coffee'
import { fileType } from '../lib/imports/mime_type.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import textify from './imports/textify.coffee'
import embeddable from './imports/embeddable.coffee'
import { DARK_MODE, MUTE_SOUND_EFFECTS } from './imports/settings.coffee'
import '/client/imports/ui/pages/graph/graph_page.coffee'
import { awaitBundleLoaded } from '/client/imports/ui/pages/logistics/logistics_page.coffee'
import '/client/imports/ui/pages/map/map_page.coffee'
import '/client/imports/ui/pages/projector/projector.coffee'
import '/client/imports/ui/pages/statistics/statistics_page.coffee'

settings = share.settings # import
model = share.model
chat = share.chat # import

# "Top level" templates:
#   "blackboard" -- main blackboard page
#   "puzzle"     -- puzzle information page
#   "round"      -- round information (much like the puzzle page)
#   "chat"       -- chat room
#   "oplogs"     -- operation logs
#   "callins"    -- answer queue
#   "facts"      -- server performance information
Template.registerHelper "equal", (a, b) -> a is b
Template.registerHelper "less", (a, b) -> a < b
Template.registerHelper 'any', (a..., options) ->
  a.some (x) -> x
Template.registerHelper 'includes', (haystack, needle) -> haystack?.includes needle 
Template.registerHelper 'all', (a..., options) ->
  a.every (x) -> x
Template.registerHelper 'not', (a) -> not a
Template.registerHelper 'split', (value, delimiter) -> value.split(delimiter)
Template.registerHelper 'concat', (a..., options) ->
  a.join(options.delimiter ? '')

# session variables we want to make available from all templates
do -> for v in ['currentPage']
  Template.registerHelper v, () -> Session.get(v)
Template.registerHelper 'abbrev', abbrev
Template.registerHelper 'callinType', human_readable
Template.registerHelper 'callinTypeAbbrev', ctabbrev
Template.registerHelper 'canonical', canonical
Template.registerHelper 'currentPageEquals', (arg) ->
  # register a more precise dependency on the value of currentPage
  Session.equals 'currentPage', arg
Template.registerHelper 'typeEquals', (arg) ->
  # register a more precise dependency on the value of type
  Session.equals 'type', arg
Template.registerHelper 'canEdit', () ->
  Meteor.userId() and (Session.get 'canEdit') and \
  (Session.equals 'currentPage', 'blackboard')

Template.registerHelper 'md5', md5
Template.registerHelper 'fileType', fileType

Template.registerHelper 'teamName', -> settings.TEAM_NAME
Template.registerHelper 'generalRoomName', -> settings.GENERAL_ROOM_NAME

Template.registerHelper 'namePlaceholder', -> settings.NAME_PLACEHOLDER

Template.registerHelper 'mynick', -> Meteor.userId()

Template.registerHelper 'embeddable', embeddable

Template.registerHelper 'plural', (x) -> x != 1

Template.registerHelper 'nullToZero', (x) -> x ? 0

Template.registerHelper 'canGoFullScreen', -> $('body').get(0)?.requestFullscreen?

Tracker.autorun ->
  if DARK_MODE.get()
    $('body').addClass 'darkMode'
  else
    $('body').removeClass 'darkMode'

Template.page.helpers
  splitter: -> Session.get 'splitter'
  topRight: -> Session.get 'topRight'
  type: -> Session.get 'type'
  id: -> Session.get 'id'
  color: -> Session.get 'color'

allPuzzlesHandle = Meteor.subscribe 'all-roundsandpuzzles'

keystring = (k) -> "notification.stream.#{k}"

# Chrome for Android only lets you use Notifications via
# ServiceWorkerRegistration, not directly with the Notification class.
# It appears no other browser (that isn't derived from Chrome) is like that.
# Since there's no capability to detect, we have to use user agent.
isAndroidChrome = -> /Android.*Chrome\/[.0-9]*/.test(navigator.userAgent)

notificationDefaults =
  callins: false
  answers: true
  announcements: true
  'new-puzzles': false
  stuck: false
  'favorite-mechanics': true
  'private-messages': true

countDependency = new Tracker.Dependency

share.notification =
  count: () ->
    countDependency.depend()
    i = 0
    for stream, def of notificationDefaults
      if reactiveLocalStorage.getItem(keystring stream) is "true"
        i += 1
    return i
  set: (k, v) ->
    ks = keystring k
    v = notificationDefaults[k] if v is undefined
    was = reactiveLocalStorage.getItem ks
    reactiveLocalStorage.setItem ks, v
    if was isnt v
      countDependency.changed()
  get: (k) ->
    ks = keystring k
    v = reactiveLocalStorage.getItem ks
    return unless v?
    v is "true"
  # On android chrome, we clobber this with a version that uses the
  # ServiceWorkerRegistration.
  notify: (title, settings) ->
    n = new Notification title, settings
    if settings.data?.url?
      n.onclick = ->
        share.Router.navigate settings.data.url, trigger: true
        window.focus()
  ask: ->
    Notification.requestPermission (ok) ->
      Session.set 'notifications', ok
      setupNotifications() if ok is 'granted'
setupNotifications = ->
  if isAndroidChrome()
    navigator.serviceWorker.register(Meteor._relativeToSiteRootUrl 'sw.js').then((reg) ->
      navigator.serviceWorker.addEventListener 'message', (msg) ->
        console.log msg.data unless Meteor.isProduction
        return unless msg.data.action is 'navigate'
        share.Router.navigate msg.data.url, trigger: true
      share.notification.notify = (title, settings) -> reg.showNotification title, settings
      finishSetupNotifications()
    ).catch (error) -> Session.set 'notifications', 'default'
    return
  finishSetupNotifications()

finishSetupNotifications = ->
  for stream, def of notificationDefaults
    share.notification.set(stream, def) unless share.notification.get(stream)?

debouncedUpdate = ->
  now = new ReactiveVar share.model.UTCNow()
  update = do ->
    next = now.get()
    push = _.debounce (-> now.set next), 1000
    (newNext) ->
      if newNext > next
        next = newNext
        push()
  {now, update}

Meteor.startup ->
  # Notifications based on oplogs
  {now, update} = debouncedUpdate()
  suppress = true
  Tracker.autorun ->
    if share.notification.count() is 0
      suppress = true
      return
    else if suppress
      now.set share.model.UTCNow()
    Meteor.subscribe 'oplogs-since', now.get(),
      onReady: -> suppress = false
  share.model.Messages.find({room_name: 'oplog/0', timestamp: $gt: now.get()}).observe
    added: (msg) ->
      update msg.timestamp
      return unless Session.equals 'notifications', 'granted'
      return unless share.notification.get(msg.stream)
      return if suppress
      gravatar = gravatarUrl
        gravatar_md5: nickHash(msg.nick)
        size: 192
      body = msg.body
      if msg.type and msg.id
        body = "#{body} #{share.model.pretty_collection(msg.type)}
                #{share.model.collection(msg.type).findOne(msg.id)?.name}"
      data = undefined
      if msg.stream is 'callins'
        data = url: '/logistics'
      else
        data = url: share.Router.urlFor msg.type, msg.id
      # If sounde effects are off, notifications should be silent. If they're not, turn off sound for
      # notifications that already have sound effects.
      silent = MUTE_SOUND_EFFECTS.get() or ['callins', 'answers'].includes msg.stream
      share.notification.notify msg.nick,
        body: body
        tag: msg._id
        icon: gravatar
        data: data
        silent: silent

Meteor.startup ->
  # Notifications on favrite mechanics
  Tracker.autorun ->
    return unless allPuzzlesHandle?.ready()
    return unless Session.equals 'notifications', 'granted'
    return unless share.notification.get 'favorite-mechanics'
    myFaves = Meteor.user()?.favorite_mechanics
    return unless myFaves
    faveSuppress = true
    myFaves.forEach (mech) ->
      share.model.Puzzles.find(mechanics: mech).observeChanges
        added: (id, puzzle) ->
          return if faveSuppress
          share.notification.notify puzzle.name,
            body: "Mechanic \"#{mechanics[mech].name}\" added to puzzle \"#{puzzle.name}\""
            tag: "#{id}/#{mech}"
            data: url: share.Router.urlFor 'puzzles', id
            silent: MUTE_SOUND_EFFECTS.get()
    faveSuppress = false

Meteor.startup ->
  # Notifications on private messages and mentions
  Tracker.autorun ->
    return unless allPuzzlesHandle?.ready()
    return unless Session.equals 'notifications', 'granted'
    return unless share.notification.get 'private-messages'
    me = Meteor.user()?._id
    return unless me?
    arnow = share.model.UTCNow()  # Intentionally not reactive
    share.model.Messages.find({$or: [{to: me}, {mention: me}], timestamp: $gt: arnow}).observeChanges
      added: (msgid, message) ->
        [room_name, url] = if message.room_name is 'general/0'
          [settings.GENERAL_ROOM_NAME, Meteor._relativeToSiteRootUrl '/']
        else
          [type, id] = message.room_name.split '/'
          target = share.model.Names.findOne id
          if target.type is type
            pretty_type = share.model.pretty_collection(type).replace /^[a-z]/, (x) -> x.toUpperCase()
            ["#{pretty_type} \"#{target.name}\"", share.Router.urlFor type, id]
          else
            [message.room_name, share.Router.chatUrlFor message.room_name]
        gravatar = gravatarUrl
          gravatar_md5: nickHash(message.nick)
          size: 192
        body = message.body
        if message.bodyIsHtml
          body = textify body
        description = if message.to?
          "Private message from #{message.nick} in #{room_name}"
        else
          "Mentioned by #{message.nick} in #{room_name}"
        share.notification.notify description,
          body: body
          tag: msgid
          data: {url}
          icon: gravatar
          silent: MUTE_SOUND_EFFECTS.get()

Meteor.startup ->
  # Notifications on announcements
  {now, update} = debouncedUpdate()
  suppress = true
  Tracker.autorun ->
    return unless Session.equals 'notifications', 'granted'
    unless share.notification.get 'announcements'
      suppress = true
      return
    else if suppress
      now.set share.model.UTCNow()
    Meteor.subscribe 'announcements-since', now.get(),
      onReady: -> suppress = false
    share.model.Messages.find({announced_at: $gt: now.get()}).observe
      added: (msg) ->
        update msg.announced_at
        return unless Session.equals 'notifications', 'granted'
        return unless share.notification.get 'announcements'
        return if suppress
        gravatar = gravatarUrl
          gravatar_md5: nickHash(msg.nick)
          size: 192
        body = msg.body
        if msg.type and msg.id
          body = "#{body} #{share.model.pretty_collection(msg.type)}
                  #{share.model.collection(msg.type).findOne(msg.id)?.name}"
        data = url: Meteor._relativeToSiteRootUrl '/'
        # If sounde effects are off, notifications should be silent. If they're not, turn off sound for
        # notifications that already have sound effects.
        silent = MUTE_SOUND_EFFECTS.get()
        share.notification.notify "Announcement by #{msg.nick}",
          body: body
          tag: msg._id
          icon: gravatar
          data: data
          silent: silent
  
Meteor.startup ->
  # Prep notifications
  unless Notification?
    Session.set 'notifications', 'denied'
    return
  Session.set 'notifications', Notification.permission
  setupNotifications() if Notification.permission is 'granted'

distToTop = (x) -> Math.abs(x.getBoundingClientRect().top - 110)

closestToTop = ->
  return unless Session.equals 'currentPage', 'blackboard'
  nearTop = $('#bb-tables')[0]
  return unless nearTop
  minDist = distToTop nearTop
  $('#bb-tables table [id]').each (i, e) ->
    dist = distToTop e
    if dist < minDist
      nearTop = e
      minDist = dist
  nearTop

scrollAfter = (x) ->
  nearTop = closestToTop()
  offset = nearTop?.getBoundingClientRect().top
  x()
  if nearTop?
    Tracker.afterFlush ->
      $("##{nearTop.id}").get(0).scrollIntoView
        behavior: 'smooth'

# Router
BlackboardRouter = Backbone.Router.extend
  routes:
    "": "BlackboardPage"
    "graph": "GraphPage"
    "map": "MapPage"
    "edit": "EditPage"
    "rounds/:round": "RoundPage"
    "puzzles/:puzzle": "PuzzlePage"
    "puzzles/:puzzle/:view": "PuzzlePage"
    "chat/:type/:id": "ChatPage"
    "oplogs": "OpLogPage"
    "facts": "FactsPage"
    "statistics": "StatisticsPage"
    "logistics": 'LogisticsPage'
    'callins': 'LogisticsRedirect'
    "projector": "ProjectorPage"

  BlackboardPage: ->
    scrollAfter =>
      @Page "blackboard", "general", "0", true, true
      Session.set
        color: 'inherit'
        canEdit: undefined
        topRight: 'blackboard_status_grid'

  EditPage: ->
    scrollAfter =>
      @Page "blackboard", "general", "0", true, true
      Session.set
        color: 'inherit'
        canEdit: true
        topRight: 'blackboard_status_grid'

  GraphPage: -> @Page 'graph', 'general', '0', false

  MapPage: -> @Page 'map', 'general', '0', false

  LogisticsPage: ->
    @Page 'logistics_page', 'general', '0', true, true
    await awaitBundleLoaded()

  LogisticsRedirect: -> @navigate '/logistics', {trigger: true, replace: true}

  ProjectorPage: -> @Page 'projector', 'general', '0', false

  PuzzlePage: (id, view=null) ->
    @Page "puzzle", "puzzles", id, true, true
    Session.set
      timestamp: 0
      view: view

  RoundPage: (id) ->
    this.goToChat "rounds", id, 0

  ChatPage: (type,id) ->
    id = "0" if type is "general"
    this.Page("chat", type, id, true)

  OpLogPage: ->
    this.Page("oplog", "oplog", "0", false)

  FactsPage: ->
    this.Page("facts", "facts", "0", false)

  StatisticsPage: ->
    this.Page("statistics", "general", "0", false)

  Page: (page, type, id, has_chat, splitter) ->
    old_room = Session.get 'room_name'
    new_room = if has_chat then "#{type}/#{id}" else null
    if old_room isnt new_room
      # if switching between a puzzle room and full-screen chat, don't reset limit.
      Session.set
        room_name: new_room
        limit: settings.INITIAL_CHAT_LIMIT
    Session.set
      splitter: splitter ? false
      currentPage: page
      type: type
      id: id
    # cancel modals if they were active
    $('.modal').modal 'hide'

  urlFor: (type,id) ->
    Meteor._relativeToSiteRootUrl "/#{type}/#{id}"
  chatUrlFor: (type, id) ->
    (Meteor._relativeToSiteRootUrl "/chat#{this.urlFor(type,id)}")

  goTo: (type,id) ->
    this.navigate(this.urlFor(type,id), {trigger:true})

  goToRound: (round) -> this.goTo("rounds", round._id)

  goToPuzzle: (puzzle) ->  this.goTo("puzzles", puzzle._id)

  goToChat: (type, id) ->
    this.navigate(this.chatUrlFor(type, id), {trigger:true})

share.Router = new BlackboardRouter()
Backbone.history.start {pushState: true}
