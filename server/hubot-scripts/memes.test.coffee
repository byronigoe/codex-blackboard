'use strict'

import memes from './memes.coffee' # for side effects
import { Messages } from '/lib/imports/collections.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import Robot from '../imports/hubot.coffee'
import { waitForDocument } from '/lib/imports/testutils.coffee'
import { MaximumMemeLength } from '/lib/imports/settings.coffee'
import delay from 'delay'
import { impersonating } from '../imports/impersonate.coffee'

describe 'memes hubot script', ->
  robot = null
  clock = null

  beforeEach ->
    resetDatabase()
    MaximumMemeLength.ensure()
    clock = sinon.useFakeTimers
      now: 6
      toFake: ["Date"]
    # can't use plain hubot because this script uses priv, which isn't part of
    # the standard message class or adapter.
    robot = new Robot 'testbot', 'testbot@testbot.test'
    memes robot
    robot.run()
    clock.tick 1

  afterEach ->
    robot.shutdown()
    clock.restore()

  it 'triggers multiple memes', ->
    Messages.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 7
      body: 'I don\'t always trigger all the meme templates, but when I do, I nailed it everywhere'
    interesting = waitForDocument Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/interesting/},
      room_name: 'general/0'
      timestamp: 7
    buzz = waitForDocument Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/buzz/},
      room_name: 'general/0'
      timestamp: 7
    xy = waitForDocument Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/xy/},
      room_name: 'general/0'
      timestamp: 7
    success = waitForDocument Messages, {nick: 'testbot', body: /https:\/\/memegen.link\/success/},
      room_name: 'general/0'
      timestamp: 7
    Promise.all [interesting, buzz, xy, success]

  it 'maximum lemgth applies', ->
    impersonating 'cjb', -> MaximumMemeLength.set 50
    Messages.insert
      nick: 'torgen'
      room_name: 'general/0'
      timestamp: 7
      body: 'I don\'t always trigger all the meme templates, but when I do, I nailed it everywhere'
    await delay 200
    chai.assert.isUndefined Messages.findOne nick: 'testbot', timestamp: 7