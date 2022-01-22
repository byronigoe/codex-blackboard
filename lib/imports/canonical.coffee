'use strict'

# canonical names: lowercases, all non-alphanumerics replaced with '_'
export default canonical = (s, separator='_') ->
  s = s.toLowerCase().replace(/^\s+/, '').replace(/\s+$/, '') # lower, strip
  # suppress 's and 't
  s = s.replace(/[\'\u2019]([st])\b/g, "$1")
  # replace all non-alphanumeric with _
  s = s.replace(/[^a-z0-9]+/g, separator).replace(new RegExp("^#{separator}"),'').replace(new RegExp("#{separator}$"),'')
  return s
