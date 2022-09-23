'use strict'

# For side effetcs
import '/lib/model.coffee'
import { Puzzles } from '/lib/imports/collections.coffee'
import { callAs } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'

describe 'feedMeta', ->
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']

  afterEach ->
    clock.restore()

  beforeEach ->
    resetDatabase()

  it 'fails without login', ->
    meta = Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      puzzles: ['yoy']
      feedsInto: []
      link: 'https://puzzlehunt.mit.edu/foo'
      tags: {}
    leaf = Puzzles.insert
      name: 'Bar'
      canon: 'bar'
      created: 2
      created_by: 'torgen'
      touched: 2
      touched_by: 'torgen'
      feedsInto: []
      link: 'https://puzzlehunt.mit.edu/bar'
      tags: {}
    chai.assert.throws ->
      Meteor.call 'feedMeta', leaf, meta
    , Match.Error

  it 'adds when not feeding yet', ->
    meta = Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      puzzles: ['yoy']
      feedsInto: []
      link: 'https://puzzlehunt.mit.edu/foo'
      tags: {}
    leaf = Puzzles.insert
      name: 'Bar'
      canon: 'bar'
      created: 2
      created_by: 'cjb'
      touched: 2
      touched_by: 'cjb'
      feedsInto: ['wew']
      link: 'https://puzzlehunt.mit.edu/bar'
      tags: {}
    callAs 'feedMeta', 'jeff', leaf, meta
    chai.assert.deepInclude Puzzles.findOne(meta),
      puzzles: ['yoy', leaf]
      touched: 7
      touched_by: 'jeff'
    chai.assert.deepInclude Puzzles.findOne(leaf),
      feedsInto: ['wew', meta]
      touched: 7
      touched_by: 'jeff'

  it 'no change when already feeding', ->
    leaf = Puzzles.insert
      name: 'Bar'
      canon: 'bar'
      created: 2
      created_by: 'cjb'
      touched: 2
      touched_by: 'cjb'
      feedsInto: ['wew']
      link: 'https://puzzlehunt.mit.edu/bar'
      tags: {}
    meta = Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      puzzles: [leaf, 'yoy']
      link: 'https://puzzlehunt.mit.edu/foo'
      tags: {}
    Puzzles.update leaf, $addToSet: feedsInto: meta
    callAs 'feedMeta', 'jeff', leaf, meta
    chai.assert.deepInclude Puzzles.findOne(meta),
      puzzles: [leaf, 'yoy']
      touched: 1
      touched_by: 'torgen'
    chai.assert.deepInclude Puzzles.findOne(leaf),
      feedsInto: ['wew', meta]
      touched: 2
      touched_by: 'cjb'

  it 'makes meta', ->
    meta = Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      puzzles: []
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      link: 'https://puzzlehunt.mit.edu/foo'
      tags: {}
    leaf = Puzzles.insert
      name: 'Bar'
      canon: 'bar'
      created: 2
      created_by: 'cjb'
      touched: 2
      touched_by: 'cjb'
      feedsInto: ['wew']
      link: 'https://puzzlehunt.mit.edu/bar'
      tags: {}
    callAs 'feedMeta', 'jeff', leaf, meta
    chai.assert.deepInclude Puzzles.findOne(meta),
      puzzles: [leaf]
      touched: 7
      touched_by: 'jeff'
    chai.assert.deepInclude Puzzles.findOne(leaf),
      feedsInto: ['wew', meta]
      touched: 7
      touched_by: 'jeff'

  it 'requires meta', ->
    leaf = Puzzles.insert
      name: 'Bar'
      canon: 'bar'
      created: 2
      created_by: 'cjb'
      touched: 2
      touched_by: 'cjb'
      feedsInto: ['wew']
      link: 'https://puzzlehunt.mit.edu/bar'
      tags: {}
    chai.assert.throws ->
      callAs 'feedMeta', 'jeff', leaf, 'nope'
    , Meteor.Error
    chai.assert.deepEqual Puzzles.findOne(leaf).feedsInto, ['wew']

  it 'requires leaf', ->
    meta = Puzzles.insert
      name: 'Foo'
      canon: 'foo'
      created: 1
      created_by: 'torgen'
      touched: 1
      touched_by: 'torgen'
      puzzles: ['yoy']
      link: 'https://puzzlehunt.mit.edu/foo'
      tags: {}
    chai.assert.throws ->
      callAs 'feedMeta', 'jeff', 'nope', meta
    , Meteor.Error
    chai.assert.deepEqual Puzzles.findOne(meta).puzzles, ['yoy']
