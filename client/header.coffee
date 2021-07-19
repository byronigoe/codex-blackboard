'use strict'

import canonical from '/lib/imports/canonical.coffee'
import md5 from '/lib/imports/md5.coffee'
import jitsiUrl from './imports/jitsi.coffee'
import { hashFromNickObject } from './imports/nickEmail.coffee'
import botuser from './imports/botuser.coffee'
import keyword_or_positional from './imports/keyword_or_positional.coffee'
import { reactiveLocalStorage } from './imports/storage.coffee'
import convertURLsToLinksAndImages from './imports/linkify.coffee'
import './imports/timestamp.coffee'

model = share.model # import
settings = share.settings # import

# templates, event handlers, and subscriptions for the site-wide
# header bar, including the login modals and general Spacebars helpers

do ->
  clickHandler = (event, template) ->
    return unless event.button is 0 # check right-click
    return if event.ctrlKey or event.shiftKey or event.altKey or event.metaKey # check alt/ctrl/shift/command clicks
    target = event.currentTarget
    # href on the element directly is absolute. We want the relative path if it exists for routing.
    rawHref = target.getAttribute 'href'
    return if /^https?:/.test rawHref
    event.preventDefault()
    if target.classList.contains 'bb-pop-out'
      # here we want the absolute path since it's for a new window.
      window.open target.href, 'Pop out', \
        ("height=480,width=480,menubar=no,toolbar=no,personalbar=no,"+\
        "status=yes,resizeable=yes,scrollbars=yes")
    else
      share.Router.navigate rawHref, {trigger:true}
  Template.page.events
    'click a.puzzles-link': clickHandler
    'click a.rounds-link': clickHandler
    'click a.chat-link': clickHandler
    'click a.graph-link': clickHandler
    'click a.home-link': clickHandler
    'click a.oplogs-link': clickHandler
    'click a.quips-link': clickHandler
    'click a.callins-link': clickHandler
    'click a.facts-link': clickHandler

Template.registerHelper 'drive_link', (args) ->
  args = keyword_or_positional 'id', args
  return model.drive_id_to_link(args.id)
Template.registerHelper 'spread_link', (args) ->
  args = keyword_or_positional 'id', args
  return model.spread_id_to_link(args.id)
Template.registerHelper 'doc_link', (args) ->
  args = keyword_or_positional 'id', args
  return model.doc_id_to_link(args.id)

# nicks
Template.registerHelper 'nickOrName', (args) ->
  nick = (keyword_or_positional 'nick', args).nick
  n = Meteor.users.findOne canonical nick
  return n?.real_name or n?.nickname or nick

privateMessageTransform = (msg) ->
  _id: msg._id
  message: msg
  cleanup: (body) ->
    unless msg.bodyIsHtml
      body = UI._escape body
      body = body.replace /\n|\r\n?/g, '<br/>'
      body = convertURLsToLinksAndImages body, "#{msg._id}-priv"
    new Spacebars.SafeString(body)
  read: ->
    msg.timestamp <= model.LastRead.findOne('private')?.timestamp || msg.timestamp <= model.LastRead.findOne(msg.room_name)?.timestamp
  showRoom: true

############## log in/protect/mute panel ####################
Template.header_loginmute.helpers
  sessionNick: -> # TODO(torgen): replace with currentUser
    user = Meteor.user()
    return unless user?
    {
      name: user.nickname
      canon: user._id
      realname: user.real_name or user.nickname
      gravatar_md5: hashFromNickObject user
    }
  unreadPrivateMessages: ->
    count = model.Messages.find
      to: Meteor.userId()
      timestamp: $gt: model.LastRead.findOne('private')?.timestamp ? 0
    .fetch().filter((msg) -> msg.timestamp > (model.LastRead.findOne(msg.room_name)?.timestamp ? 0)).length
    count = "9+" if count > 9
    count unless count is 0
  privateMessages: ->
    model.Messages.find
      to: Meteor.userId()
    ,
      sort: timestamp: -1
      transform: privateMessageTransform

Template.header_loginmute.events
  "click .bb-logout": (event, template) ->
    event.preventDefault()
    Meteor.logout()
  "click .bb-unprotect": (event, template) ->
    share.Router.navigate "/edit", {trigger: true}
  "click .bb-protect": (event, template) ->
    share.Router.navigate "/", {trigger: true}
  'click #bb-mark-private-read': (event, template) ->
    event.preventDefault()
    latest = model.Messages.findOne({to: Meteor.userId()}, {sort: timestamp: -1}).timestamp
    Meteor.call 'updateLastRead',
      room_name: 'private'
      timestamp: latest

Template.connection_button.helpers
  connectStatus: Meteor.status

Template.connection_button.events
  "click .connected, click .connecting, click .waiting": (event, template) ->
    Meteor.disconnect()
  "click .failed, click .offline": (event, template) ->
    Meteor.reconnect()

############## breadcrumbs #######################

crumbs_equal = (x, y) ->
  return false unless x.length is y.length
  for xi, i in x
    yi = y[i]
    return false unless xi.type is yi.type
    return false unless xi.page is yi.page
    continue if xi.id is yi.id
    return false unless 'object' is typeof xi.id
    return false unless 'object' is typeof yi.id
    return false unless Object.keys(xi.id).length is Object.keys(yi.id).length
    for k, v of xi.id
      return false unless yi.id[k]?
      return false unless yi.id[k] is v
  true

breadcrumbs_var = new ReactiveVar [{page: 'blackboard', type: 'general', id: '0'}], crumbs_equal

in_crumbs = (crumbs, type, id) ->
  return false unless crumbs?
  for crumb in crumbs
    continue unless crumb.type is type
    if crumb.page is 'metas'
      return true if crumb.id[id]?
    else
      return true if crumb.id is id
  false

# One autorun to determine if the current page should be the leaf.
# Basically, if the current page isn't in the current breadcrumb trail,
# it should be the leaf.
Tracker.autorun ->
  breadcrumbs = breadcrumbs_var.get()
  type = Session.get 'type'
  id = Session.get 'id'
  unless in_crumbs breadcrumbs, type, id
    Session.set
      breadcrumbs_leaf_type: type
      breadcrumbs_leaf_id: id

# Because our graph is unweighted, BFS suffices--we don't need something fancy
# like Dijkstra.
min_meta_paths = (root) ->
  depth = 0
  current = [root]
  next = {}
  depths = {}
  trail = []
  depths[root] = -1
  loop
    for id in current
      puzzle = model.Puzzles.findOne id
      continue unless puzzle?
      for meta in puzzle.feedsInto
        unless depths[meta]?
          depths[meta] = depth
          next[meta] = depth
    current = Object.keys next
    unless current.length
      return trail
    trail.push next
    depth++
    next = {}

generate_crumbs = (leaf_type, leaf_id) ->
  crumbs = [{page: 'blackboard', type: 'general', id: '0'}]
  leaf_type = Session.get 'breadcrumbs_leaf_type'
  leaf_id = Session.get 'breadcrumbs_leaf_id'
  return crumbs unless leaf_type? and leaf_id?
  if leaf_type is 'puzzles'
    metas = min_meta_paths leaf_id
    # Deepest are last here, so...
    metas.reverse()
    # One breadcrumb for each level of meta.
    # Consider grouping together beyond some number of levels
    for meta in metas
      crumbs.push {page: 'metas', type: 'puzzles', id: meta}
    crumbs.push {page: 'puzzle', type: 'puzzles', id: leaf_id}
  else if leaf_type is 'rounds'
    crumbs.push {page: 'round', type: 'rounds', id: leaf_id}
  else if leaf_type is 'quips'
    crumbs.push {page: 'quip', type: 'quips', id: leaf_id}
  else
    unless leaf_type is 'general'
      crumbs.push {page: leaf_type, type: leaf_type, id: leaf_id}
  crumbs

# A second autorun to determine what should be in the crumbs. 
# Basically, if the current type/id is the leaf, always regenerate the crumbs
# from the breadcrumb leaf.
# Otherwise generate them only if the current type/id appears in the new trail.
# This stops the current crumb from vanishing if you're viewing a meta above a
# puzzle when the puzzle is removed from the meta.
Tracker.autorun ->
  leaf_type = Session.get 'breadcrumbs_leaf_type'
  leaf_id = Session.get 'breadcrumbs_leaf_id'
  crumbs = generate_crumbs leaf_type, leaf_id
  type = Session.get 'type'
  id = Session.get 'id'
  unless type is leaf_type and id is leaf_id
    return unless in_crumbs crumbs, type, id
  breadcrumbs_var.set crumbs

Template.header_breadcrumb_chat.helpers
  inThisRoom: ->
    return false unless Session.equals 'currentPage', 'chat'
    return false unless Session.equals 'type', @type
    Session.equals 'id', @id

active = ->
  Session.equals('type', @type) and Session.equals('id', @id)

Template.header_breadcrumb_blackboard.helpers
  active: active

Template.header_breadcrumb_callins.helpers
  active: active

Template.header_breadcrumb_extra_links.helpers
  active: -> active.call(Template.parentData(1))
  jitsiUrl: -> jitsiUrl Template.parentData(1).type, Template.parentData(1).id

Template.header_breadcrumb_round.onCreated ->
  @autorun =>
    @subscribe 'round-by-id', Template.currentData().id
Template.header_breadcrumb_round.helpers
  round: -> model.Rounds.findOne @id if @id
  active: active

Template.header_breadcrumb_metas.helpers
  active_meta: ->
    return unless Session.equals 'type', @type
    id = Session.get 'id'
    if @id[id]?
      return id
  inactive_metas: ->
    keys = Object.keys @id
    if Session.equals 'type', @type
      id = Session.get 'id'
      keys = keys.filter (x) -> x isnt id
    if keys.length is 1
      one: keys[0]
      all: keys
    else if keys.length is 0
      {}
    else
      all: keys

Template.header_breadcrumb_one_meta.onCreated ->
  @autorun =>
    @subscribe 'puzzle-by-id', Template.currentData().id
    @subscribe 'metas-for-puzzle', Template.currentData().id
Template.header_breadcrumb_one_meta.helpers
  puzzle: -> model.Puzzles.findOne @id if @id
  active: active

Template.header_breadcrumb_puzzle.onCreated ->
  @autorun =>
    @subscribe 'puzzle-by-id', Template.currentData().id
    @subscribe 'metas-for-puzzle', Template.currentData().id
Template.header_breadcrumb_puzzle.helpers
  puzzle: -> model.Puzzles.findOne @id if @id
  active: active

Template.header_breadcrumb_quip.onCreated ->
  @autorun => @subscribe 'quips'
Template.header_breadcrumb_quip.helpers
  idIsNew: -> 'new' is @id
  quip: -> model.Quips.findOne @id

Template.header_breadcrumbs.onCreated ->
  @autorun =>
    Meteor.call 'getRinghuntersFolder', (error, f) ->
      unless error?
        Session.set 'RINGHUNTERS_FOLDER', (f or undefined)

Template.header_breadcrumbs.helpers
  breadcrumbs: -> breadcrumbs_var.get()
  crumb_template: -> "header_breadcrumb_#{@page}"
  active: active
  puzzle: ->
    if Session.equals 'type', 'puzzles'
      model.Puzzles.findOne Session.get 'id'
    else null
  picker: -> settings.PICKER_CLIENT_ID? and settings.PICKER_APP_ID? and settings.PICKER_DEVELOPER_KEY?
  drive: -> switch Session.get 'type'
    when 'general'
      Session.get 'RINGHUNTERS_FOLDER'
    when 'puzzles'
      model.Puzzles.findOne(Session.get 'id')?.drive
  generalChat: -> Session.equals 'room_name', 'general/0'

Template.header_breadcrumbs.events
  "click .bb-upload-file": (event, template) ->
    folder = switch Session.get 'type'
      when 'general'
        Session.get 'RINGHUNTERS_FOLDER'
      when 'puzzles'
        model.Puzzles.findOne(Session.get 'id')?.drive
    return unless folder
    uploadToDriveFolder folder, (docs) ->
      message = "uploaded "+(for doc in docs
        "<a href='#{UI._escape doc.url}' target='_blank'><img src='#{UI._escape doc.iconUrl}' />#{UI._escape doc.name}</a> "
      ).join(', ')
      Meteor.call 'newMessage',
        body: message
        bodyIsHtml: true
        action: true
        room_name: Session.get('type')+'/'+Session.get('id')

Template.header_breadcrumbs.onRendered ->
  # tool tips
  $(this.findAll('a.bb-drive-link[title]')).tooltip placement: 'bottom'

uploadToDriveFolder = share.uploadToDriveFolder = (folder, callback) ->
  google = window?.google
  gapi = window?.gapi
  unless google? and gapi?
    console.warn 'Google APIs not loaded; Google Drive disabled.'
    return
  uploadView = new google.picker.DocsUploadView()\
    .setParent(folder)
  pickerCallback = (data) ->
    switch data[google.picker.Response.ACTION]
      when "loaded"
        return
      when google.picker.Action.PICKED
        doc = data[google.picker.Response.DOCUMENTS][0]
        url = doc[google.picker.Document.URL]
        callback data[google.picker.Response.DOCUMENTS]
      else
        console.log 'Unexpected action:', data
  gapi.auth.authorize
    client_id: settings.PICKER_CLIENT_ID
    scope: ['https://www.googleapis.com/auth/drive']
    immediate: false
  , (authResult) ->
    oauthToken = authResult?.access_token
    if authResult?.error or !oauthToken
      console.log 'Authentication failed', authResult
      return
    new google.picker.PickerBuilder()\
      .setAppId(settings.PICKER_APP_ID)\
      .setDeveloperKey(settings.PICKER_DEVELOPER_KEY)\
      .setOAuthToken(oauthToken)\
      .setTitle('Upload Item')\
      .addView(uploadView)\
      .enableFeature(google.picker.Feature.NAV_HIDDEN)\
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)\
      .setCallback(pickerCallback)\
      .build().setVisible true


############## nick selection ####################

Template.header_nickmodal_contents.onCreated ->
  @suppressRender = new ReactiveVar Meteor.loggingIn()
  @autorun =>
    @suppressRender.set false unless Meteor.loggingIn()
  @gravatarHash = new ReactiveVar md5('')
  # we'd need to subscribe to 'all-nicks' here if we didn't have a permanent
  # subscription to it (in main.coffee)
  this.typeaheadSource = (query,process) =>
    this.update(query)
    (n.nickname for n in Meteor.users.find(bot_wakeup: $exists: false).fetch())
  this.update = (query, options) =>
    # can we find an existing nick matching this?
    n = if query then Meteor.users.findOne canonical query else undefined
    if (n or options?.force)
      realname = n?.real_name
      $('#nickRealname').val(realname or '')
      $('#nickEmail').val('')
    this.updateGravatar(n)
  this.updateGravatar = (q) =>
    if $('#nickEmail').val()
      @gravatarHash.set md5 $('#nickEmail').val()
      return
    unless q?
      q = _id: canonical($('#nickInput').val())
    @gravatarHash.set hashFromNickObject q
nickInput = new Tracker.Dependency
Template.header_nickmodal_contents.helpers
  suppressRender: -> Template.instance().suppressRender.get()
  disabled: ->
    nickInput.depend()
    Meteor.loggingIn() or not $('#nickInput').val()
  hash: -> Template.instance().gravatarHash.get()
Template.header_nickmodal_contents.onRendered ->
  $('#nickSuccess').val('false')
  $('#nickPickModal').modal keyboard: false, backdrop:"static"
  $('#nickInput').select()
  firstNick = Meteor.userId() or ''
  $('#nickInput').val firstNick
  this.update firstNick, force:true
  $('#nickInput').typeahead
    source: this.typeaheadSource
    updater: (item) =>
      this.update(item)
      return item
Template.header_nickmodal_contents.events
  "click .bb-submit": (event, template) ->
    $('#nickPick').submit()
  'input #nickInput': (event, template) ->
    nickInput.changed()
  "keydown #nickInput": (event, template) ->
    # implicit submit on <enter> if typeahead isn't shown
    if event.which is 13 and not $('#nickInput').data('typeahead').shown
      $('#nickPick').submit()
  "keydown #nickRealname": (event, template) ->
    $('#nickEmail').select() if event.which is 13
  "keydown #nickEmail": (event, template) ->
    $('#nickPick').submit() if event.which is 13
  "input #nickEmail": _.debounce ((event, template) -> template.updateGravatar()), 500
  'submit #nickPick': (event, template) ->
    nick = $("#nickInput").val().replace(/^\s+|\s+$/g,"") #trim
    return false unless nick
    Meteor.loginWithCodex nick, $('#nickRealname').val(), $('#nickEmail').val(), $('#passwordInput').val(), (err, res) ->
      if err?
        le = $("#loginError")
        if err.reason?
          le.text err.reason
        if err.details?.field?
          template.$('[data-argument]').removeClass 'error'
          template.$("[data-argument=\"#{err.details.field}\"]").addClass 'error'
    return false

############## confirmation dialog ########################
Template.header_confirmmodal.helpers
  confirmModalVisible: -> !!(Session.get 'confirmModalVisible')
Template.header_confirmmodal_contents.onRendered ->
  $('#confirmModal .bb-confirm-cancel').focus()
  $('#confirmModal').modal show: true
Template.header_confirmmodal_contents.events
  "click .bb-confirm-ok": (event, template) ->
    Template.header_confirmmodal_contents.cancel = false # do the thing!
    $('#confirmModal').modal 'hide'

confirmationDialog = share.confirmationDialog = (options) ->
  $('#confirmModal').one 'hide', ->
    Session.set 'confirmModalVisible', undefined
    options.ok?() unless Template.header_confirmmodal_contents.cancel
  # store away options before making dialog visible
  Template.header_confirmmodal_contents.options = -> options
  Template.header_confirmmodal_contents.cancel = true
  Session.set 'confirmModalVisible', (options or Object.create(null))

RECENT_GENERAL_LIMIT = 2

############## operation/chat log in header ####################
Template.header_lastchats.helpers
  lastchats: ->
    options = [{room_name: 'oplog/0'}, {to: Meteor.userId()}]
    unless Session.equals('room_name', 'general/0')
      options.push room_name: 'general/0'
    model.Messages.find {
      $or: options, system: {$ne: true}, bodyIsHtml: {$ne: true}, header_ignore: {$ne: true}
    }, {sort: [["timestamp","desc"]], limit: RECENT_GENERAL_LIMIT}
  msgbody: ->
    if this.bodyIsHtml then new Spacebars.SafeString(this.body) else this.body
  roomname: ->
    if Session.equals('room_name', 'general/0')
      'Updates'
    else
      settings.GENERAL_ROOM_NAME
  roomicon: ->
    query = if Session.equals('room_name', 'general/0')
      'newspaper'
    else
      'comments'
  puzzle_id: -> @room_name.match(/puzzles\/(.*)/)[1]
  icon_label: ->
    if /Added/.test @body
      if @type is 'puzzles'
        ['puzzle-piece', 'success']
      else if @type is 'rounds'
        ['globe', 'success']
      else if @type is 'quips'
        ['comment-dots']
      else
        ['plus']
    else if /Deleted answer/.test @body
      ['sad-tear', 'important']
    else if /Deleted/.test @body
      ['trash-alt', 'info']
    else if /Renamed/.test @body
      ['id-badge', 'info']
    else if /New.*submitted for/.test @body
      ['phone', 'success']
    else if /Canceled call-in/.test @body
      ['phone-slash', 'important']
    else if /Help requested/.test @body
      ['ambulance', 'warning']
    else if /Help request cancelled/.test @body
      ['lightbulb', 'success']
    else if /Found an answer/.test @body
      ['trophy', 'success']
    else if /reports incorrect answer/.test @body
      ['heart-broken', 'important']
    else if @stream is 'announcements'
      ['bullhorn', 'info']
    else
      ['exclamation-circle']

# subscribe when this template is in use/unsubscribe when it is destroyed
Template.header_lastchats.onCreated ->
  return if settings.BB_DISABLE_RINGHUNTERS_HEADER
  @autorun =>
    this.subscribe 'recent-messages', 'oplog/0', 2
    @subscribe 'recent-header-messages'
