'use strict'

import {fileType} from '/lib/imports/mime_type.coffee'

model = share.model

GDRIVE_DOC_MIME_TYPE = 'application/vnd.google-apps.document'

# Exposed for testing
export startPageTokens = new Mongo.Collection('start_page_tokens');
startPageTokens.createIndex(({timestamp: 1}));

# Exposed for testing
# Fields:
# announced: timestamp when the existence of this file was announced in chat
export driveFiles = new Mongo.Collection('drive_files');

# TODO: make configurable?
POLL_INTERVAL = 60000

CHANGES_FIELDS = "nextPageToken,newStartPageToken,changes(changeType,removed,fileId,file(name,mimeType,parents,createdTime,modifiedTime,webViewLink))"

export default class DriveChangeWatcher
  constructor: (@driveApi, @rootDir, @env = Meteor) ->
    lastToken = startPageTokens.findOne {}, {limit: 1, sort: timestamp: -1}
    unless lastToken
      {data: {startPageToken}} = Promise.await @driveApi.changes.getStartPageToken()
      lastToken =
        timestamp: model.UTCNow()
        token: startPageToken
      startPageTokens.insert lastToken
    @startPageToken = lastToken.token
    @lastPoll = lastToken.timestamp
    @timeoutHandle = @env.setTimeout (=> @poll()), Math.max(0, lastToken.timestamp + POLL_INTERVAL - model.UTCNow())

  poll: ->
    token = @startPageToken
    pollStart = model.UTCNow()
    try
      promises = []
      loop
        {data} = Promise.await @driveApi.changes.list
          pageToken: token
          pageSize: 1000
          fields: CHANGES_FIELDS
        updates = new Map()  # key: puzzle id, value: max modifiedTime of file with it as parent
        created = new Map()  # key: file ID, value: {name, mimeType, webViewLink, channel}
        promises.push ...data.changes.map ({changeType, removed, fileId, file}) =>
          return unless changeType is 'file'
          return if removed
          {name, mimeType, parents, createdTime, modifiedTime, webViewLink} = file
          return unless parents?
          moddedAt = Date.parse modifiedTime
          createdAt = Date.parse createdTime
          channel = null
          puzzleId = null
          # Uploads can have a created time of when they're uploaded, but a modified time of
          # whatever the file being uploaded had.
          moddedAt = createdAt if createdAt > moddedAt
          if parents.includes @rootDir
            channel = 'general/0'
          else
            puzzle = await model.Puzzles.rawCollection().findOne {drive: $in: parents}
            return unless puzzle?
            puzzleId = puzzle._id
            channel = "puzzles/#{puzzleId}" unless puzzle.spreadsheet is fileId or puzzle.doc is fileId
          if puzzleId?
            update = updates.get(puzzleId)
            unless update?
              update = {}
              updates.set puzzleId, update
            update.timestamp = moddedAt unless update.timestamp > moddedAt
            update.doc ?= fileId if mimeType is GDRIVE_DOC_MIME_TYPE and puzzle? and not puzzle.doc?
          if channel?
            unless (await driveFiles.rawCollection().findOne(_id: fileId))?.announced?
              created.set fileId, {name, mimeType, webViewLink, channel}
        if data.nextPageToken?
          token = data.nextPageToken
        else if data.newStartPageToken?
          break
        else throw new Error("Response had neither nextPageToken nor newStartPageToken")
      Promise.await Promise.all promises
      bulkPuzzleUpdates = for [puzzle, {timestamp, doc}] from updates
        updateDoc = $max: drive_touched: timestamp
        if doc?
          updateDoc.$set = {doc}
        updateOne:
          filter: _id: puzzle
          update: updateDoc
      puzzlePromise = if bulkPuzzleUpdates.length
          model.Puzzles.rawCollection().bulkWrite bulkPuzzleUpdates, ordered: false
      else
        Promise.resolve()
      created.forEach ({name, mimeType, webViewLink, channel}, fileId) =>
        # Would be nice to use bulk write here, but since we're not forcing a particular ID
        # we could have mismatched meteor vs. mongo ID types.
        now = model.UTCNow()
        msg = model.Messages.insert
          body: "#{fileType(mimeType)} \"#{name}\" added to drive folder: #{webViewLink}"
          system: true
          room_name: channel
          bot_ignore: true
          useful: true
          file_upload: {name, mimeType, webViewLink, fileId}
          timestamp: now
        driveFiles.upsert fileId,
          $max: announced: now
      Promise.await puzzlePromise
      @lastPoll = pollStart
      @startPageToken = data.newStartPageToken
      startPageTokens.upsert {},
        $set:
          timestamp: pollStart
          token: data.newStartPageToken
      ,
        multi: false
        sort: timestamp: 1
    catch e
      console.error e
    @env.clearTimeout @timeoutHandle
    @timeoutHandle = Meteor.setTimeout (=> @poll()), POLL_INTERVAL

  stop: ->
    @env.clearTimeout @timeoutHandle
