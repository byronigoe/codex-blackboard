'use strict'

import {waitForSubscriptions, waitForMethods, afterFlushPromise, promiseCall, login, logout} from './imports/app_test_helpers.coffee'
import Router from '/client/imports/router.coffee'
import jitsiModule from './imports/jitsi.coffee'
import chai from 'chai'
import sinon from 'sinon'
import {reactiveLocalStorage} from './imports/storage.coffee'
import { CLIENT_UUID } from '/client/imports/server_settings.coffee'
import { Puzzles } from '/lib/imports/collections.coffee'

GRAVATAR_200 = 'https://secure.gravatar.com/avatar/a24f643d34150c3b4053989db38251c9.jpg?d=wavatar&s=200'

class FakeJitsiMeet
  dispose: ->
  once: (event, handler) ->
  executeCommand: (cmd, param) ->
  executeCommands: (cmds) ->

defaultLogin = -> login 'testy', 'Teresa Tybalt', 'fake@artifici.al', 'failphrase'

describe 'jitsi', ->
  @timeout 10000

  factory = null
  beforeEach ->
    factory = sinon.mock(jitsiModule).expects('createJitsiMeet')
    factory.never()

  expectFactory = ->
    fake = new FakeJitsiMeet
    mock = sinon.mock fake
    factory.verify()
    factory.resetHistory()
    factory.once().returns fake
    return mock
  
  afterEach ->
    await logout()
    sinon.verify()

  it 'uses static meeting name', ->
    mock = expectFactory()
    onceExp = mock.expects('once').twice()

    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    chai.assert.isTrue factory.calledWithMatch 'codex_whiteNoiseFoyer', sinon.match.instanceOf(HTMLDivElement)
    chai.assert.isTrue onceExp.getCalls().some (call) ->
      if call.calledWith 'videoConferenceJoined', sinon.match.func
        call.args[1]()
        return true
      return false
    mock.expects('executeCommand').once().withArgs 'subject', 'Ringhunters'
    mock.expects('executeCommands').once().withArgs
      displayName: 'Teresa Tybalt (testy)'
      avatarUrl: GRAVATAR_200
    await afterFlushPromise()

  it 'shares meeting between blackboard and edit', ->
    mock = expectFactory()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    Router.EditPage()
    await afterFlushPromise()
    chai.assert.equal factory.callCount, 1

  it 'shares meeting between blackboard and logistics', ->
    mock = expectFactory()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    await Router.LogisticsPage()
    await waitForSubscriptions()
    await afterFlushPromise()
    chai.assert.equal factory.callCount, 1

  it 'joins new meeting when moving from blackboard to puzzle', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    mock2 = expectFactory()
    onceExp = mock2.expects('once').twice()
    dispose2 = mock2.expects('dispose').never()
    puzz = Puzzles.findOne name: 'In Memoriam'
    Router.PuzzlePage puzz._id
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose2.verify()
    chai.assert.isTrue onceExp.getCalls().some (call) ->
      if call.calledWith 'videoConferenceJoined', sinon.match.func
        call.args[1]()
        return true
      return false
    mock2.expects('executeCommand').once().withArgs 'subject', 'In Memoriam'
    await afterFlushPromise()
    dispose2.once()

  it 'stays in meeting when pinned', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    $('.bb-jitsi-pin').click()
    await afterFlushPromise()
    puzz = Puzzles.findOne name: 'In Memoriam'
    Router.PuzzlePage puzz._id
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    mock2 = expectFactory()
    $('.bb-jitsi-unpin').click()
    await afterFlushPromise()
    dispose1.verify()

  it 'doesn\'t rejoin when hangup callback is called', ->
    mock1 = expectFactory()
    on1 = mock1.expects('once').twice()
    dispose1 = mock1.expects('dispose').never()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    on1.verify()
    chai.assert.isTrue on1.getCalls().some (call) ->
      if call.calledWith 'videoConferenceLeft', sinon.match.func
        call.args[1]()
        return true
      return false
    await afterFlushPromise()
    dispose1.verify()
    puzz = Puzzles.findOne name: 'In Memoriam'
    Router.PuzzlePage puzz._id
    await afterFlushPromise()
    await waitForSubscriptions()
    mock2 = expectFactory()
    $('.bb-join-jitsi').click()
    await afterFlushPromise()

  it 'disposes when another tab joins meeting', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    dispose1.verify()
    dispose1.once()
    try
      reactiveLocalStorage.setItem 'jitsiTabUUID', Random.id()
      await afterFlushPromise()
      dispose1.verify()
      puzz = Puzzles.findOne name: 'In Memoriam'
      Router.PuzzlePage puzz._id
      await afterFlushPromise()
      await waitForSubscriptions()
    finally
      reactiveLocalStorage.removeItem 'jitsiTabUUID'

  it 'join button clobbers other tab', ->
    reactiveLocalStorage.setItem 'jitsiTabUUID', Random.id()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    mock = expectFactory()
    $('.bb-join-jitsi').click()
    await afterFlushPromise()
    chai.assert.equal reactiveLocalStorage.getItem('jitsiTabUUID'), CLIENT_UUID

  it 'doesn\'t rejoin when mute preference changes', ->
    mock1 = expectFactory()
    dispose1 = mock1.expects('dispose').never()
    Router.BlackboardPage()
    await defaultLogin()
    await afterFlushPromise()
    await waitForSubscriptions()
    try
      reactiveLocalStorage.setItem 'startAudioMuted', 'false'
      await afterFlushPromise()
      dispose1.verify()
      dispose1.once()
    finally
      reactiveLocalStorage.setItem 'startAudioMuted', null
      

