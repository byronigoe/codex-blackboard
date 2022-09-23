'use strict'

import canonical from '/lib/imports/canonical.coffee'
import { collection } from '/lib/imports/collections.coffee'
import { StaticJitsiMeeting } from '/lib/imports/settings.coffee'
import { JITSI_SERVER, TEAM_NAME } from '/client/imports/server_settings.coffee'
import { START_AUDIO_MUTED, START_VIDEO_MUTED } from './settings.coffee'

export jitsiRoom = (roomType, roomId) ->
  return unless roomId
  meeting = "#{roomType}_#{roomId}"
  if roomId is '0'
    return unless StaticJitsiMeeting.get()
    meeting = StaticJitsiMeeting.get()
  else
    override = collection(roomType)?.findOne(_id: roomId)?.tags?.jitsi?.value
    meeting = override if override?
  "#{canonical(TEAM_NAME)}_#{meeting}"

# We need settings to load the jitsi api since it's conditional and the domain
# is variable. This means we can't put it in the head, and putting it in the
# body can mean the embedded chat is already rendered when it loads.
# Therefore we set this ReactiveVar if/when it's finished loading so we
# can retry the appropriate autorun once it loads.
jitsiLoaded = new ReactiveVar false

Meteor.startup ->
  return unless JITSI_SERVER
  $('body').addClass('using-jitsi')
  $.getScript "https://#{JITSI_SERVER}/external_api.js", ->
    jitsiLoaded.set true  

export createJitsiMeet = (room, container) ->
  return null unless jitsiLoaded.get()
  return new JitsiMeetExternalAPI JITSI_SERVER,
    roomName: room
    parentNode: container
    interfaceConfigOverwrite:
      TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'fullscreen', \
        'fodeviceselection', 'profile', 'sharedvideo', 'settings', \
        'raisehand', 'videoquality', 'filmstrip', 'feedback', 'shortcuts', \
        'tileview', 'videobackgroundblur', 'help', 'hangup' ]
      SHOW_CHROME_EXTENSION_BANNER: false
    configOverwrite:
      # These properties are reactive, but changing them won't make us reload the room
      # because newRoom will be the same as @jitsiRoom.
      startWithAudioMuted: START_AUDIO_MUTED.get()
      startWithVideoMuted: START_VIDEO_MUTED.get()
      prejoinPageEnabled: false
      enableTalkWhileMuted: false
      'analytics.disabled': true

export jitsiUrl = (roomType, roomId) ->
  return unless JITSI_SERVER
  room = jitsiRoom roomType, roomId
  return unless room?
  "https://#{JITSI_SERVER}/#{room}"
