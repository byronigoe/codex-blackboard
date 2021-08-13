'use strict'

import {waitForSubscriptions, waitForMethods, afterFlushPromise, login, logout} from './imports/app_test_helpers.coffee'
import chai from 'chai'

describe 'chat', ->
  @timeout 10000
  before ->
    login('testy', 'Teresa Tybalt', '', '')
  
  after ->
    logout()

  it 'general chat', ->
    share.Router.ChatPage('general', '0')
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isDefined $('a[href^="https://codexian.us"]').html()
    chai.assert.isDefined $('img[src^="https://memegen.link/doge"]').html()

  it 'updates read marker', ->
    id = share.model.Puzzles.findOne(name: 'Temperance')._id
    share.Router.ChatPage('puzzles', id)
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.isUndefined $('.bb-message-last-read').html()
    $('#messageInput').focus()
    await afterFlushPromise()
    chai.assert.isDefined $('.bb-message-last-read').html()

  it 'scrolls through history', ->
    id = share.model.Puzzles.findOne(name: 'Joy')._id
    share.Router.ChatPage('puzzles', id)
    await waitForSubscriptions()
    await afterFlushPromise()
    input = $ '#messageInput'
    input.val '/me tests actions'
    input.trigger $.Event('keydown', {which: 13})
    chai.assert.equal input.val(), '', 'after first submit'
    input.val 'say another thing'
    input.trigger $.Event('keydown', {which: 13})
    chai.assert.equal input.val(), '', 'after second submit'
    await waitForSubscriptions()
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), 'say another thing', 'after first up'
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), '/me tests actions', 'after second up'
    input.trigger $.Event('keydown', {key: 'Up'})
    chai.assert.equal input.val(), '/me tests actions', 'after third up'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '/me tests actions', 'after down with selection at start'
    input[0].setSelectionRange input.val().length, input.val().length
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), 'say another thing', 'after first down'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '', 'after second down'
    input.trigger $.Event('keydown', {key: 'Down'})
    chai.assert.equal input.val(), '', 'after third down'

  describe 'typeahead', ->

    it 'accepts keyboard commands', ->
      id = share.model.Puzzles.findOne(name: 'Disgust')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/m a'
      input.click()
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'kwal', a.data('value'), 'initial'
      input.trigger $.Event('keydown', {key: 'Down'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'testy', a.data('value'), 'one down'
      input.trigger $.Event('keydown', {key: 'Up'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'kwal', a.data('value'), 'up after down'
      input.trigger $.Event('keydown', {key: 'Up'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'zachary', a.data('value'), 'wraparound up'
      input.trigger $.Event('keydown', {key: 'Down'})
      await afterFlushPromise()
      a = $ '#messageInputTypeahead li.active a'
      chai.assert.equal 'kwal', a.data('value'), 'wraparound down'
      input.trigger $.Event('keydown', {key: 'Tab'})
      await afterFlushPromise()
      chai.assert.equal input.val(), '/m kwal '
      chai.assert.equal input[0].selectionStart, 8
      typeahead = $ '#messageInputTypeahead'
      chai.assert.equal 0, typeahead.length

    it 'allows clicks', ->
      id = share.model.Puzzles.findOne(name: 'Space Elevator')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val 'Yo @es hmu'
      input[0].setSelectionRange 4, 4
      input.click()
      await afterFlushPromise()
      $('a[data-value="testy"]').click()
      await afterFlushPromise()
      chai.assert.equal input.val(), 'Yo @testy  hmu'
      chai.assert.equal input[0].selectionStart, 10
      typeahead = $ '#messageInputTypeahead'
      chai.assert.equal 0, typeahead.length

  describe 'submit', ->

    it 'mentions', ->
      id = share.model.Puzzles.findOne(name: 'Showcase')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '@kwal you hear about @Cscott?'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepInclude msg,
        mention: ['kwal', 'cscott']

    it 'nonexistent mentions', ->
      id = share.model.Puzzles.findOne(name: 'Soooo Cute!')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '@kwal exists but @flibby does not'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepEqual msg.mention, ['kwal']

    it 'action', ->
      id = share.model.Puzzles.findOne(name: 'This SHOULD Be Easy')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/me heard about @Cscott'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepInclude msg,
        action: true
        mention: ['cscott']
        body: 'heard about @Cscott'

    it 'messages', ->
      id = share.model.Puzzles.findOne(name: 'Charm School')._id
      share.Router.ChatPage('puzzles', id)
      await waitForSubscriptions()
      await afterFlushPromise()
      input = $ '#messageInput'
      input.val '/msg kwal you hear about @Cscott?'
      input.trigger $.Event 'keydown', which: 13
      await waitForMethods()
      await afterFlushPromise()
      msg = share.model.Messages.findOne {nick: 'testy', room_name: "puzzles/#{id}"}, {sort: {timestamp: -1}}
      chai.assert.deepInclude msg,
        to: 'kwal'
      chai.assert.isNotOk msg.mention
