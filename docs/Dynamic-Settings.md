# Dynamic Settings

Some of the settings for the blackboard are easy to specify in advance--for example, credentials for external services.
Other settings can only be determined once the hunt has started, which is not when you want to restart the blackboard
to modify environment variables. These settings can be controlled via the bot. Note that the current, authoritative
list of settings, including their default and current values, can be enumerated by entering `/msg bot global list` in
any chat room. You can edit any dynamic setting from the Logistics page by clicking the gear icon in the top right
panel. You can also edit them from any chat room by saying `bot global set SETTING NAME to VALUE`. The bot will
tell you if your value is illegal for the setting you chose.

## Round URL Prefix

Hunt sites tend to have common patterns for the URLs for the various rounds. The blackboard can attempt to derive the
URL for a round based on its name and the common name normalization algorithm it uses throughout. Set this to the path
to the directory that contains the rounds to enable this. Don't set this if there's no single directory that contains
all the rounds.

Format: empty string, or a URL with the HTTP or HTTPS protocol.

## Puzzle URL Prefix

Hunt sites also tend to have common patterns for the URLs for the various puzzles. The blackboard can attempt to derive
the URL for a puzzle based on its name and the common name normalization algorithm it uses throughout. Set this to the
path to the directory that contains the puzzles to enable this. Don't set this if there's no single directory that
contains all the puzzles, e.g. because they're grouped by the round they're in. In this case the oncall will have to
set the URL for each puzzle individually. Also remember that this isn't foolproof; for example, in 2019 the Problems
(i.e. metapuzzles) had a different URL prefix than the leaf puzzles.

Format: empty string, or a URL with the HTTP or HTTPS protocol.

## URL Separator

For Round URL Prefix and Puzzle URL Prefix, the spaces in the puzzle name are trypically replaced with some other
character. In the past it was typically `_`, but recently it has been `-`. Once you know what it is, you can set this
to it.

Format: string

## Embed Puzzles

It is possible to set the X-Frame-Options header on an HTTP response to tell browsers not to render that page in an
iframe. MIT hunt sites tend not to use this, but other hunts like Caltech have. If the hunt you're solving does set
this header, the puzzle tab on the puzzle page, which shows the puzzle alongside the chat, will be useless and generate
errors. Set this to false to hide it.

Format: boolean

## Maximum Meme Length

Unless it was disabled with an environment variable, there is a Hubot module that generates memes for common patterns.
This setting controls the maximum length of the regular expression match that can generate a meme. You might increase
it before the hunt starts while people are playing around and decrease it to a reasonable limit to avoid annoying
people with long memes that match a tiny subset of a long message later.

Format: integer

## Static Jitsi Room

If a Jitsi server is enabled, this is appended to the team name to make the room used for the blackboard and callins
pages. If you set it to the empty string, those pages won't have a room. It is not expected that you will often want to
change this during the hunt, but unlike a public setting it's only visible after login.

Format: string; a single URL path component.

## Role Renewal Time

How many minutes you have to renew holding a role (either explicitly or by taking a role action) before it expires.
Defaults to 60.

Format: integer

## Statistics Collection Time

Time in minutes between collections of periodic statistics for the chart view at `/statistics` and `/projector`. If
nobody is using those views, this wastes space, so don't set it. Setting it to 0 disables collection, but any
previously collected points are still preserved and graphed.
Currently the only statistic collected is number of solvers online.

Format: integer
