'use strict'

import { NonEmptyString, ObjectWith } from '/lib/imports/match.coffee'
import { collection } from '/lib/imports/collections.coffee'

Accounts.removeDefaultRateLimit()

Meteor.methods
  wait: ->
  setAnyField: (args) ->
    check @userId, NonEmptyString
    check args, ObjectWith
      type: NonEmptyString
      object: NonEmptyString
      fields: Object
    now = Date.now()
    args.fields.touched = now
    args.fields.touched_by = @userId
    collection(args.type).update args.object, $set: args.fields
    return true
