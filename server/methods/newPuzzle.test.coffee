'use strict'

# Will access contents via share
import '/lib/model.coffee'
# Test only works on server side; move to /server if you add client tests.
import { callAs, impersonating } from '/server/imports/impersonate.coffee'
import chai from 'chai'
import sinon from 'sinon'
import { resetDatabase } from 'meteor/xolvio:cleaner'
import isDuplicateError from '/lib/imports/duplicate.coffee'
import { PuzzleUrlPrefix, RoleRenewalTime, UrlSeparator } from '/lib/imports/settings.coffee'

model = share.model

describe 'newPuzzle', ->
  driveMethods = null
  clock = null
  beforeEach ->
    clock = sinon.useFakeTimers
      now: 7
      toFake: ['Date']
    driveMethods =
      createPuzzle: sinon.fake.returns
        id: 'fid' # f for folder
        spreadId: 'sid'
      renamePuzzle: sinon.spy()
      deletePuzzle: sinon.spy()
    if share.drive?
      sinon.stub(share, 'drive').value(driveMethods)
    else
      share.drive = driveMethods

  afterEach ->
    clock.restore()
    sinon.restore()

  beforeEach ->
    resetDatabase()
    PuzzleUrlPrefix.ensure()
    RoleRenewalTime.ensure()
    UrlSeparator.ensure()

  it 'fails without login', ->
    chai.assert.throws ->
      Meteor.call 'newPuzzle',
        name: 'Foo'
        link: 'https://puzzlehunt.mit.edu/foo'
    , Match.Error
    
  describe 'when none exists with that name', ->
    round = null
    id = null
    describe 'when onduty', -> 
      beforeEach ->
        round = model.Rounds.insert
          name: 'Round'
          canon: 'round'
          created: 1
          created_by: 'cjb'
          touched: 1
          touched_by: 'cjb'
          puzzles: []
        model.Roles.insert
          _id: 'onduty'
          holder: 'torgen'
          claimed_at: 2
          renewed_at: 2
          expires_at: 3600002
        id = callAs 'newPuzzle', 'torgen',
          name: 'Foo'
          link: 'https://puzzlehunt.mit.edu/foo'
          round: round
        ._id

      it 'creates puzzle', ->
        chai.assert.deepInclude model.Puzzles.findOne(id),
          name: 'Foo'
          canon: 'foo'
          created: 7
          created_by: 'torgen'
          touched: 7
          touched_by: 'torgen'
          solved: null
          solved_by: null
          link: 'https://puzzlehunt.mit.edu/foo'
          drive: 'fid'
          spreadsheet: 'sid'
          tags: {}

      it 'adds puzzle to round', ->
        chai.assert.deepInclude model.Rounds.findOne(round),
          touched: 7
          touched_by: 'torgen'
          puzzles: [id]
      
      it 'oplogs', ->
        chai.assert.lengthOf model.Messages.find({id: id, type: 'puzzles'}).fetch(), 1
      
      it 'renews onduty', ->
        chai.assert.deepInclude model.Roles.findOne('onduty'),
          holder: 'torgen'
          claimed_at: 2
          renewed_at: 7
          expires_at: 3600007

    describe 'when someone else is onduty', -> 
      beforeEach ->
        round = model.Rounds.insert
          name: 'Round'
          canon: 'round'
          created: 1
          created_by: 'cjb'
          touched: 1
          touched_by: 'cjb'
          puzzles: []
        model.Roles.insert
          _id: 'onduty'
          holder: 'florgen'
          claimed_at: 2
          renewed_at: 2
          expires_at: 3600002
        id = callAs 'newPuzzle', 'torgen',
          name: 'Foo'
          link: 'https://puzzlehunt.mit.edu/foo'
          round: round
        ._id

      it 'leaves onduty alone', ->
        chai.assert.deepInclude model.Roles.findOne('onduty'),
          holder: 'florgen'
          claimed_at: 2
          renewed_at: 2
          expires_at: 3600002

    describe 'when nobody is onduty', -> 
      beforeEach ->
        round = model.Rounds.insert
          name: 'Round'
          canon: 'round'
          created: 1
          created_by: 'cjb'
          touched: 1
          touched_by: 'cjb'
          puzzles: []
        id = callAs 'newPuzzle', 'torgen',
          name: 'Foo'
          link: 'https://puzzlehunt.mit.edu/foo'
          round: round
        ._id

      it 'leaves onduty alone', ->
        chai.assert.isNotOk model.Roles.findOne('onduty')

  describe 'with mechanics', ->
    round = null
    beforeEach ->
      round = model.Rounds.insert
        name: 'Round'
        canon: 'round'
        created: 1
        created_by: 'cjb'
        touched: 1
        touched_by: 'cjb'
        puzzles: []

    it 'dedupes mechanics', ->
      id = callAs 'newPuzzle', 'torgen',
        name: 'Foo'
        link: 'https://puzzlehunt.mit.edu/foo'
        round: round
        mechanics: ['crossword', 'crossword', 'cryptic_clues']
      ._id
      chai.assert.deepEqual model.Puzzles.findOne(id).mechanics, ['crossword', 'cryptic_clues']

    it 'rejects bad mechanics', ->
      chai.assert.throws ->
        callAs 'newPuzzle', 'torgen',
          name: 'Foo'
          link: 'https://puzzlehunt.mit.edu/foo'
          round: round
          mechanics: ['acrostic']
      , Match.Error


  it 'derives link', ->
    impersonating 'cjb', -> PuzzleUrlPrefix.set 'https://testhuntpleaseign.org/puzzles'
    round = model.Rounds.insert
      name: 'Round'
      canon: 'round'
      created: 1
      created_by: 'cjb'
      touched: 1
      touched_by: 'cjb'
      puzzles: []
    id = callAs 'newPuzzle', 'torgen',
      name: 'Foo Puzzle'
      round: round
    ._id
    chai.assert.deepInclude model.Puzzles.findOne(id),
      name: 'Foo Puzzle'
      canon: 'foo_puzzle'
      created: 7
      created_by: 'torgen'
      touched: 7
      touched_by: 'torgen'
      solved: null
      solved_by: null
      link: 'https://testhuntpleaseign.org/puzzles/foo-puzzle'
      drive: 'fid'
      spreadsheet: 'sid'
      tags: {}

  describe 'when one exists with that name', ->
    round = round
    id1 = null
    error = null
    beforeEach ->
      id1 = model.Puzzles.insert
        name: 'Foo'
        canon: 'foo'
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'
        solved: null
        solved_by: null
        link: 'https://puzzlehunt.mit.edu/foo'
        drive: 'fid'
        spreadsheet: 'sid'
        tags: {}
      round = model.Rounds.insert
        name: 'Round'
        canon: 'round'
        created: 1
        created_by: 'cjb'
        touched: 1
        touched_by: 'cjb'
        puzzles: [id1]
      try
        callAs 'newPuzzle', 'cjb',
          name: 'Foo'
          round: round
      catch err
        error = err
    
    it 'throws duplicate error', ->
      chai.assert.isTrue isDuplicateError(error), "#{error}"

    it 'doesn\'t touch', ->
      chai.assert.include model.Puzzles.findOne(id1),
        created: 1
        created_by: 'torgen'
        touched: 1
        touched_by: 'torgen'

    it 'doesn\'t oplog', ->
      chai.assert.lengthOf model.Messages.find({id: id1, type: 'puzzles'}).fetch(), 0

  describe 'when drive fails', ->
    round = null
    beforeEach ->
      round = model.Rounds.insert
        name: 'Round'
        canon: 'round'
        created: 1
        created_by: 'cjb'
        touched: 1
        touched_by: 'cjb'
        puzzles: []
      share.drive.createPuzzle = sinon.fake.throws('user limits')

    it 'sets status', ->
      id = callAs 'newPuzzle', 'torgen',
        name: 'Foo'
        link: 'https://puzzlehunt.mit.edu/foo'
        round: round
      ._id
      chai.assert.include model.Puzzles.findOne(id),
        drive_status: 'failed'
        drive_error_message: 'Error: user limits'
