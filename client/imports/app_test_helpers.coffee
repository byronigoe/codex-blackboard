'use strict'

import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { DDP } from 'meteor/ddp-client';
import denodeify from 'denodeify'
import loginWithCodex from '/client/imports/accounts.coffee'

# Utility -- returns a promise which resolves when all subscriptions are done
export waitForSubscriptions = -> new Promise (resolve) ->
  poll = Meteor.setInterval -> 
    if DDP._allSubscriptionsReady()
      Meteor.clearInterval(poll)
      resolve()
  , 200

export waitForMethods = -> new Promise (resolve) ->
  Meteor.apply 'wait', [], {wait: true}, resolve

# Tracker.afterFlush runs code when all consequent of a tracker based change
#   (such as a route change) have occured. This makes it a promise.
export afterFlushPromise = denodeify(Tracker.afterFlush)

export login = denodeify(loginWithCodex)

_logout = denodeify(Meteor.logout)

export logout = ->
  await _logout()
  await afterFlushPromise()

export promiseCall = denodeify(Meteor.call)

export promiseCallOn = (x, ...a) -> denodeify(x.call.bind(x))(a...)
