'use strict'

# For side effects
import '/lib/model.coffee'
import { Messages, Presence } from '/lib/imports/collections.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from './hubot.coffee'
import delay from 'delay'
import { waitForDocument } from '/lib/imports//testutils.coffee'

describe 'hubot', ->

  clock = null
  robot = null

  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ["setInterval", "clearInterval", "Date"]
    robot = new Robot 'testbot', 'testbot@testbot.test'

  afterEach ->
    robot.shutdown()
    clock.restore()

  beforeEach ->
    resetDatabase()

  it 'is present in main room', ->
    robot.run()
    chai.assert.include Presence.findOne(nick: 'testbot', room_name: 'general/0'),
      timestamp: 7
    clock.tick 15000
    chai.assert.include Presence.findOne(nick: 'testbot', room_name: 'general/0'),
      timestamp: 7
    clock.tick 15000
    chai.assert.include Presence.findOne(nick: 'testbot', room_name: 'general/0'),
      timestamp: 30007

  it 'announces presence', ->
    robot.run()
    chai.assert.include Messages.findOne(dawn_of_time: $ne: true),
      nick: 'testbot'
      body: 'wakes up'
      action: true
      room_name: 'general/0'

  it 'ignores old messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    Messages.insert
      timestamp: Date.now() - 2
      nick: 'torgen'
      room_name: 'general/0'
      body: 'sample'
    robot.run()
    chai.assert.isFalse spy.called

  it 'ignores old future messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    Messages.insert
      timestamp: Date.now() + 1000
      nick: 'torgen'
      room_name: 'general/0'
      body: 'sample'
    robot.run()
    chai.assert.isFalse spy.called

  it 'receives new messages', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    await new Promise (resolve, reject) ->
      robot.hear /.*/, resolve
      robot.run()
      Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        body: 'sample'
    chai.assert.isFalse spy.called

  it 'ignores itself', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    Messages.insert
      timestamp: Date.now() + 1
      nick: 'testbot'
      room_name: 'general/0'
      body: 'sample'
    await delay 200
    chai.assert.isFalse spy.called

  it 'ignores HTML messages', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: '<b>sample</b>'
      bodyIsHtml: true
    await delay 200
    chai.assert.isFalse spy.called

  it 'ignores actions', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: 'samples a puzzle'
      action: true
    await delay 200
    chai.assert.isFalse spy.called

  it 'ignores with bot_ignore', ->
    spy = sinon.spy()
    robot.enter spy
    robot.leave spy
    robot.hear /.*/, spy
    robot.run()
    Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: 'sample'
      bot_ignore: true
    await delay 200
    chai.assert.isFalse spy.called

  it 'receives enter messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    robot.leave spy
    await new Promise (resolve, reject) ->
      robot.enter resolve
      robot.run()
      Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        presence: 'join'
        system: true
    chai.assert.isFalse spy.called

  it 'receives leave messages', ->
    spy = sinon.spy()
    robot.hear /.*/, spy
    robot.enter spy
    await new Promise (resolve, reject) ->
      robot.leave resolve
      robot.run()
      Messages.insert
        timestamp: Date.now() + 1
        nick: 'torgen'
        room_name: 'general/0'
        presence: 'part'
        system: true
    chai.assert.isFalse spy.called

  it 'replies to public messages publicly', ->
    robot.respond /hello/, (msg) ->
      clock.tick 2
      msg.reply 'hello yourself'
    robot.run()
    id = Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: 'testbot hello'
    await waitForDocument Messages, {body: '@torgen: hello yourself', to: $exists: false},
      timestamp: 9
      nick: 'testbot'
      room_name: 'general/0'
      bot_ignore: true
      mention: ['torgen']
    chai.assert.include Messages.findOne(id), useless_cmd: true

  it 'replies to private messages privately', ->
    robot.respond /hello/, (msg) ->
      clock.tick 1
      msg.reply 'hello yourself'
    robot.run()
    clock.tick 1
    id = Messages.insert
      timestamp: Date.now()
      nick: 'torgen'
      room_name: 'general/0'
      body: 'hello'
      to: 'testbot'
    await waitForDocument Messages, {body: 'hello yourself', to: 'torgen'}, 
      timestamp: 9
      nick: 'testbot'
      room_name: 'general/0'
      bot_ignore: true
    chai.assert.notDeepInclude Messages.findOne(id), useless_cmd: true

  it 'emotes to public messages publicly', ->
    robot.respond /hello/, (msg) ->
      clock.tick 2
      msg.emote 'waves'
    robot.run()
    id = Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      room_name: 'general/0'
      body: 'testbot hello'
    await waitForDocument Messages, {body: 'waves', to: $exists: false},
      timestamp: 9
      nick: 'testbot'
      room_name: 'general/0'
      bot_ignore: true
      action: true
    chai.assert.include Messages.findOne(id), useless_cmd: true

  it 'emotes to private messages privately', ->
    robot.respond /hello/, (msg) ->
      clock.tick 2
      msg.emote 'waves'
    robot.run()
    id = Messages.insert
      timestamp: Date.now() + 1
      nick: 'torgen'
      to: 'testbot'
      room_name: 'general/0'
      body: 'hello'
    await waitForDocument Messages, {body: '*** waves ***', to: 'torgen', action: $ne: true},
      timestamp: 9
      nick: 'testbot'
      room_name: 'general/0'
      bot_ignore: true
    chai.assert.notDeepInclude Messages.findOne(id), useless_cmd: true

  it 'sends publicly', ->
    robot.respond /hello/, (msg) ->
      clock.tick 1
      msg.send useful: true, 'hello was said'
    robot.run()
    clock.tick 1
    id = Messages.insert
      timestamp: Date.now()
      nick: 'torgen'
      room_name: 'general/0'
      body: 'testbot hello'
    await waitForDocument Messages, {body: 'hello was said', to: $exists: false},
      timestamp: 9
      nick: 'testbot'
      room_name: 'general/0'
      bot_ignore: true
      useful: true
    chai.assert.notDeepInclude Messages.findOne(id), useless_cmd: true

  it 'privs privately', ->
    robot.respond /hello/, (msg) ->
      clock.tick 1
      msg.priv 'psst. hello'
    robot.run()
    clock.tick 1
    id = Messages.insert
      timestamp: Date.now()
      nick: 'torgen'
      room_name: 'general/0'
      body: 'testbot hello'
    await waitForDocument Messages, {body: 'psst. hello', to: 'torgen'},
      timestamp: 9
      nick: 'testbot'
      room_name: 'general/0'
      bot_ignore: true
    chai.assert.include Messages.findOne(id), useless_cmd: true
  
  