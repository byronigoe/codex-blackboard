'use strict'

model = share.model # import

Template.link.onCreated ->
  @target = new ReactiveVar null
  @autorun =>
    @target.set model.Names.findOne(Template.currentData().id)

Template.link.helpers
  target: -> Template.instance().target.get()
  text: -> Template.instance().data.text ? Template.instance().target.get()?.name
