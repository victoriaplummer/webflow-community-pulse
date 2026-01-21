# Full AutoModerator documentation

This page is a full specification of AutoModerator's capabilities and behavior, and the syntax for utilizing it. If you are new to AutoModerator and are looking for information about how to set it up and write basic rules, please see [the Introduction page](/wiki/automoderator) and [Writing Basic Rules](/wiki/automoderator/writing-basic-rules).

## General knowledge/behavior

- AutoModerator's configuration is kept on a subreddit's wiki, at the "config/automoderator" page.
- Rules that may result in an item being removed (action of `remove`, `spam`, or `filter`) are always checked before all other rules.
- By default, submissions and comments made by moderators of the subreddit will not be checked against any rules that may cause the post to be removed or reported. You can override this behavior with the `moderators_exempt` flag.
- AutoModerator tries to avoid contradicting other moderators, and will not approve items that have already been removed by another moderator, or remove items that have already been approved by another mod.
- AutoModerator will not approve items posted by users that are banned site-wide on reddit unless the approval rule includes a check against author name.
- Approval conditions will not re-approve reported items unless the rule includes a `reports:` check.
- Approval actions will only be performed on items that need to be approved to change their state. That is, only items that were automatically removed by reddit's spam-filter, or reported items (as long as the rule includes a `reports:` check as mentioned above).
- AutoModerator will not leave an entry in the moderation log when it sets flair or distinguishes its comments. All other actions (removals, approvals, etc.) will be logged as with any other moderator.
- Rules on the body field will always apply to text posts. By default, these rules will not apply to other post types unless some body text is present.

## Syntax

AutoModerator rules are defined using [YAML](https://en.wikipedia.org/wiki/YAML), so for full details about allowable syntax you can look up examples or [the YAML specification](http://www.yaml.org/spec/1.2/spec.html) (kind of a difficult/technical document). Some of the most important things to know for AutoModerator specifically:

Rules must be separated by a line starting with exactly 3 hyphens - `---`.

Comments can be added by using the `#` symbol. Generally everything after a `#` on a line will be treated as a comment and ignored, unless the `#` is inside a string or otherwise part of actual syntax.

Strings do not generally _need_ to be quoted, but it is usually safest to put either single or double quotes around a string, especially if it includes any special characters at all. For example, the quotes here are unnecessary but encouraged:

    title: ["red", "blue", "green"]

If you do not use quotes, there are certain types of strings that the YAML parser will try to automatically convert, which can result in unexpected behavior. In general, these include strings of numbers that start with `0` or `0x`, strings that consist of only numbers and underscores, and the words `true`, `false`, `on`, `off`, `yes`, `no`. If in doubt, it is always safest to use quotes.

When defining regular expressions inside a search check, you should always surround the regular expression with quotes, but **single** quotes are highly encouraged. This avoids needing to double-escape. For example, this check includes the exact same regex twice, but the double-quoted version requires double-escaping all the special characters:

    title (regex): ["\\[\\w+\\]", '\[\w+\]']

Note that if you need to include a single quote inside a single-quoted string, the way to do so is by typing two single quotes in a row, not with a backslash. For example: `'it''s done like this'`.

Multi-line strings can be defined as well, this is used almost exclusively for defining multi-line comments to post or messages/modmails to send. The syntax for a multi-line string is to have a single pipe character (`|`) on the first line, and then indent all lines of the multi-line string below and inside. For example:

    comment: |
        This is a multi-line comment.

        It has multiple lines.

        You can use **markdown** inside here too.

Lists of items can be defined in two different ways. The most compact method is inside square brackets, comma-separated:

    title: ["red", "green", "blue"]

The other method is by indenting the list of items below, with a hyphen at the start of each line. This format is often better for longer or more complex items, or if you want to add a comment on individual items:

    title:
        - "red" # like apples
        - "green" # like grapes
        - "blue" # like raspberries

Both formats are exactly the same from AutoModerator's perspective, but one can often be far easier to read than the other.

You should always avoid defining the same thing twice inside a particular rule. This will just end up with the second definition overwriting the first one. For example, a rule like this will end up only affecting youtube submissions and not imgur:

    domain: imgur.com
    domain: youtube.com
    action: remove

## Top-level-only checks/actions

The following checks/actions are only available in the top level of a rule, and cannot be included inside sub-groups:

- `type` - defines the type of item this rule should be checked against. Valid values are `comment`, `submission`, `text submission`, `link submission`, `crosspost submission`, `poll submission`, `gallery submission` or `any` (default).
- `priority` - must be set to a number. Can be used to define the order that rules should be checked in (though they will still always be checked in two separate groups - rules that might cause any sort of removal first - ones with action of `remove`, `spam` or `filter`, and then all others). Rules with higher priority values will be checked first. If a rule does not have a priority defined, it defaults to zero. Negative priority values can be used as well to specify that certain rules should be checked after ones with no defined priority value.
- `moderators_exempt` - true/false - Defines whether the rule should be skipped when the author of the item is a moderator of the subreddit. Mods are exempt from rules that can result in a removal or report by default, so set this to false to override that behavior, or set it to true to make them exempt from any other rules.
- `comment` - Text of a comment to post in response to an item that satisfies the rule's conditions. Supports placeholders.
- `comment_locked` - true/false - if set to true, the comment automoderator posts in response to an item will be locked from further comment replies.
- `comment_stickied` - true/false - if set to true, the comment automoderator posts in response to an item will be stickied to the top of the submission (will have no effect on non-submissions, as the comment must be top-level)
- `modmail` - Text of a modmail to send to the moderators when an item satisfies the rule's conditions. Supports placeholders.
- `modmail_subject` - If a modmail is sent, the subject of that modmail. Defaults to "AutoModerator notification" if not set. Supports placeholders.
- `message` - Text of a message to send to the author of an item that satisfies the rule's conditions. Supports placeholders.
- `message_subject` - If a message is sent, the subject of that message. Defaults to "AutoModerator notification" if not set. Supports placeholders.

## Sub-groups

AutoModerator rules also support "sub-groups" of checks and actions that apply to things that are related to the main item being targeted by the rule. There are currently five supported sub-groups, `author`, `crosspost_author`, `crosspost_subreddit`, `subreddit`, and `parent_submission`. `parent_submission` can be used only if the main item is a comment, but `author` and `crosspost_author` can always be used. The `author` targets the author of the new submission or comment in question, the `crosspost_author` targets the author of the original submission. If `crosspost_author` is being used and the base item being checked **isn't** a crosspost, then the rule will not be applied. `crosspost_subreddit` targets the subreddit of the original post. `subreddit` targets the subreddit this rule is being applied within, and is only used for checking the active temporary event label. Checks and actions inside the sub-group should be indented below and inside it. For example, here is a rule that utilizes both sub-groups to set a submission's flair text to "Possible Repost" if a user with the "trusted" flair css class makes a top-level comment inside it including the word "repost":

    type: comment
    body: "repost"
    is_top_level: true
    author:
        flair_css_class: "trusted"
    parent_submission:
        set_flair: "Possible Repost"

## Search Checks

These checks can be used to look for words/phrases/patterns in different fields.

- Search checks can be reversed by starting the name with `~`. If this is done, the check will only be satisfied if the fields being searched do NOT contain any of the options.
- Search checks can be combined by joining them with `+`. If this is done, the check will be satisfied if ANY of the fields joined together contain one of the options.
- Search checks are case-insensitive by default.

Available fields to check against:

**For all submissions (base item or parent_submission sub-group):**

- `id` - the submission's base-36 ID.
- `title` - the submission's title
- `domain` - the submission's domain. For a text submission, this is "self.subredditname". For gallery submissions, the domain of the optional image outbound urls.
- `url` - the submission's full url. Cannot be checked for text submissions. For gallery submissions, the url of the optional image outbound urls.
- `body` - The full text of the post. It will always be checked for text posts, and checked for other post types only when text is present. For gallery submissions, the optional image captions are included in evaluation.
- `flair_text` - the text of the submission's link flair
- `flair_css_class` - the css class of the submission's link flair
- `flair_template_id` - the template id of the submission's link flair
- `poll_option_text` - The text of each option in a poll post
- `poll_option_count` - The number of options a poll post has.

**For crossposts submissions:**

The following fields will always be checked against the fields of the original submission.

- `domain` - if the submission is a crosspost, then check the domain of the original submission
- `url` - if the submission is a crosspost, then check the full url of the original submission
- `body` - if the submission is a crosspost, then check the body of the original submission

In addition, we have the following fields that will check the original submission. If the submission _isn't_ a crosspost, then a rule with any of these attributes will be ignored.

- `crosspost_id` - if the submission is a crosspost, then check the base-36 ID of the original submission
- `crosspost_title` - if the submission is a crosspost, then check the title of the original submission

### Media checks

On submissions, it is also possible to do some checks against the "media object" that gets embedded in reddit. If the submission is a crosspost, then the values of the original submission are checked. The media data that is available comes from embed.ly, so you can see what information is available for a specific link by testing it here: http://embed.ly/extract

- `media_author` - the author name returned from embed.ly (usually the username of the uploader on the media site)
- `media_author_url` - the author's url returned from embed.ly (usually the link to their user page on the media site)
- `media_title` - the media title returned from embed.ly
- `media_description` - the media description returned from embed.ly

**For comments (base item only):**

- `id` - the comment's base-36 ID
- `body` - the full text of the comment.

**For users (inside author or crosspost_author sub-group):**

- `id` - the user's base-36 ID
- `name` - the user's name
- `flair_text` - the text of the user's flair in the subreddit
- `flair_css_class` - the css class of the user's flair in the subreddit
- `flair_template_id` - the template id of the user's flair in the subreddit

**For subreddits (inside subreddit or crosspost_subreddit):**

- `name` - the name of the subreddit where the original submission was posted

## Matching modifiers

These modifiers change how a search check behaves. They can be used to ensure that the field being searched starts with the word/phrase instead of just including it, allow you to define regular expressions, etc.

To specify modifiers for a check, put the modifiers in parentheses after the check's name. For example, a `body+title` check with the `includes` and `regex` modifiers would look like:

    body+title (includes, regex): ["whatever", "who cares?"]

**Match search methods**

These modifiers change how the search options for looked for inside the field, so only one of these can be specified for a particular match. body will always be checked for text posts, and checked for other post types only when text is present.

- `includes-word` - searches for an entire word matching the text
- `includes` - searches for the text, regardless of whether it is included inside other words
- `starts-with` - only checks if the subject starts with the text
- `ends-with` - only checks if the subject ends with the text
- `full-exact` - checks if the entire subject matches the text _exactly_
- `full-text` - similar to `full-exact`, except punctuation/spacing on either end of the subject is not considered

**Other modifiers**

- `regex` - considers the text being searched for to be a regular expression (using [standard Python regex syntax](https://docs.python.org/2/library/re.html#regular-expression-syntax)), instead of literal text to find
- `case-sensitive` - makes the search case-sensitive, so text with different capitalization than the search value(s) will not be considered a match

If you do not specify a search method modifier for a particular check, it will default to one depending on which field you are checking. Note that if you do any joined search check (multiple fields combined with `+`), the default is always `includes-word`. Otherwise, if you are checking a single subject field, the defaults are as follows:

- `domain`: special check that looks only for the exact domain or a subdomain of it
- `id`: `full-exact`
- `url`: `includes`
- `flair_text`: `full-exact`
- `flair_css_class`: `full-exact`
- `flair_template_id`: `full-exact`
- `media_author`: `full-exact`
- `media_author_url`: `includes`

All other fields default to `includes-word`.

## Non-searching checks

Other checks that can be used that are not search checks (so do not take a value or list of values to look for, cannot be joined with `+` or reversed with `~`, etc.).

**For submissions (base item or parent_submission sub-group):**

- `reports` - must be set to a number. The minimum number of reports the submission must have to trigger the rule.
- `body_longer_than` - must be set to a number. The submission's body must be longer than this number of characters to trigger the rule (spacing and punctuation characters on either end are not counted). This will always be checked for text posts, and checked for other post types only when text is present.
- `body_shorter_than` - must be set to a number. The submission's body must be shorter than this number of characters to trigger the rule (spacing and punctuation characters on either end are not counted). This will always be checked for text posts, and checked for other post types only when text is present.
- `is_edited` - true/false - if set to true, submissions will only trigger the rule if they have been edited. if set to false, submissions will only trigger the rule if they have NOT been edited (so new submissions will be checked against the rule, but they will not be re-checked on edit).
- `is_original_content` - true/false - if set to true, submissions will only trigger the rule if they are flagged as `OC` (original content). If set to false, submission will only trigger the rule if the are NOT flagged as `OC`.
- `is_poll` - true/false - if set to true, submissions will only trigger the rule if they are of the poll submission type.
- `is_gallery` - true/false - if set to true, submissions will only trigger the rule if they are of the gallery submission type.
- `discussion_type` - chat/null - if set to chat, then it will apply to chat posts. if set to null it will apply to comment posts. if this is not specified it will apply to both
- `is_meta_discussion` - true/false - if set to true, submissions will only trigger the rule if they link to a Meta post (invoked by admins).
- `past_archive_date` - true/false - if set to true, submissions will only trigger the rule if they are older than the archival date of 6 months. See [this post](https://www.reddit.com/r/modnews/comments/py2xy2/voting_commenting_on_archived_posts/) for details.

**For comments (base item only):**

- `reports` - must be set to a number. The minimum number of reports the comment must have to trigger the rule.
- `body_longer_than` - must be set to a number. The comment's body must be longer than this number of characters to trigger the rule (spacing and punctuation characters on either end are not counted).
- `body_shorter_than` - must be set to a number. The comment's body must be shorter than this number of characters to trigger the rule (spacing and punctuation characters on either end are not counted).
- `is_top_level` - true/false - if set to true, comments will only trigger the rule if they are top-level comments (posted in reply to the submission itself, not to another comment). If set to false, comments will only trigger the rule if they are NOT top-level comments (posted in reply to another comment).
- `is_edited` - if set to true, comments will only trigger the rule if they have been edited. If set to false, comments will only trigger the rule if they have NOT been edited (so new comments will be checked against the rule, but they will not be re-checked on edit).

**For subreddits (inside subreddit or crosspost_subreddit):**

- `is_nsfw` - true/false - If true, will only match if the subreddit of the original submission is NSFW
- `event_label` - a matching label for the currently active temporary event, if any. This can be used to restrict automoderator rules to only apply if certain temporary events are currently active. [See here for more on temporary events](https://support.reddithelp.com/hc/en-us/articles/27018580066708-Temporary-events).

**For users (inside author or crosspost_author sub-group):**

**Contributor Quality Score (CQS) checks**

These checks are often used as a more holistic replacement for karma or account age checks. CQS can help you vet good contributors for specific kinds of content in your community like weekly threads, posts with a specific flair, or general contribution in the subreddit. Every account is assigned one of five CQS scores: _highest_, _high_, _moderate_, _low_, _lowest_.

Moderators can use CQSs via the _contributor_quality_ field in automod.

For example, to filter content from authors with a CQS of _moderate_ or higher, the check would be:

    author:
        contributor_quality: "< moderate"
        action: filter
        action_reason: "CQS Filter"

**Karma/age threshold checks**

These checks are most often used as "thresholds" - greater than or less than checks. They can be specified using the < or > symbol followed by the value to check if the author has more or less than. For example, to check if the author has less than 10 post karma, the check would be:

    author:
        post_karma: < 10

Note that due to the > symbol having a special meaning in YAML syntax, you **must** put quotes around a greater-than check, but it is not necessary for less-than checks. For example, a check to see if the author has more than 10 post karma would have to be written as:

    author:
        post_karma: '> 10'

The supported threshold checks are:

- `comment_karma` - compare to the author's comment karma (note that comment karma will not go below -100)
- `post_karma` - compare to the author's post karma (note that post karma will not go below 0)
- `combined_karma` - compare to the author's combined (comment karma + post karma, combination can not be below -100)

- `comment_subreddit_karma` - compare to the author's comment karma in your community (note that comment karma will not go below -100)
- `post_subreddit_karma` - compare to the author's post karma in your community (note that post karma will not go below 0)
- `combined_subreddit_karma` - compare to the author's combined (comment karma + post karma) karma in your community (comment karma + post karma, combination can not be below -100)

- `account_age` - compare to the age of the author's account. This check also supports specifying a unit (default is days), so you can specify something like `account_age: < 60 hours`. Supported units are minutes, hours, days, weeks, months, and years.

- `satisfy_any_threshold` - true/false - If true and any karma or age threshold checks are being done, only one of the checks will need to be successful. If false, ALL the checks will need to be satisfied for the rule to trigger (this is the default behavior).

**Other user checks**

- `has_verified_email`- true/false - if true, will only match if the author has a verified email address or a phone number. If false, will only match if the author does not have neither a verified email address nor a phone number.
- `is_gold` - true/false - If true, will only match if the author has reddit gold. If false, will only match if they do not have gold.
- `is_submitter` - true/false - (only relevant when checking comments) If true, will only match if the author was also the submitter of the post being commented inside. If false, will only match if they were not.
- `is_contributor` - true/false - if true, will only match if the author is a contributor/"approved submitter" in the subreddit. If false, will only match if they are not.
- `is_moderator` - true/false - if true, will only match if the author is a moderator of the subreddit. If false, will only match if the author is NOT a moderator of the subreddit.

## Actions

**For submissions (base item or parent_submission sub-group)**:

- `action` - A moderation action to perform on the item. Valid values are `approve`, `remove`, `spam`, `filter`, or `report`. `filter` is a unique action to AutoModerator, and will remove the post but keep it in the modqueue and unmoderated pages.
- `action_reason` - Displays in the moderation log as a reason for why a post was approved or removed. If the action is `report`, displays as the report reason instead. Supports placeholders.
- `set_flair` - Takes either a single string, a list of two strings or a dictionary. If given a single string, the submission's flair text will be set to the string. If given two strings, the first string will be used for the flair text, and the second string for the flair css class. If given a dictionary, the keys will be one of 'text', 'css_class', or 'template_id'. If set, the value of 'text' will be used for the flair text and the value of 'css_class' will be used for the css class. When using the dictionary syntax, 'template_id' must be set, and the value of 'template_id' will be used to set the flair template (template Ids are accessible in Post Flair and User Flair sections of Mod Tools). The flair text, flair css class and flair template id can include placeholders.
- `overwrite_flair` - true/false - If true, a `set_flair` action will overwrite any previous link flair on the submission. If false (same as default behavior), any existing flair will not be overwritten.
- `set_sticky` - true/false or a number - Sets or unsets the matched submission as a sticky in the subreddit. If you use a number (for example `set_sticky: 1`), the post will replace any existing sticky in that slot. Using `true` will work the same as clicking the "sticky this post" link on the post - it will go into the bottom sticky slot (replacing a post that's already there, if necessary).
- `set_nsfw` - true/false - Enables (true) or disables (false) the NSFW flag on the submission.
- `set_spoiler` - true/false - Enables (true) or disables (false) the spoiler flag on the submission.
- `set_contest_mode` - true/false - Enables (true) or disables (false) contest mode for the submission's comments.
- `set_original_content` - true/false – Enables (true) or disables (false) the OC (original content) flag on the submission.
- `set_suggested_sort` - Sets the item's [suggested comment sort](https://www.reddit.com/r/modnews/comments/342xo2/moderators_qa_sort_suggested_sorts_now_live/). Valid values are `best`, `new`, `qa`, `top`, `controversial`, `hot`, `old`, `random` and `blank` (`confidence` is also available as an alias for `best`). Setting to `blank` is different than not setting at all - it will make it so that the user's default sort is used instead of the subreddit's (if the subreddit has one).
- `set_locked` - true/false - Locks or unlocks the submission or comment.
- `set_post_crowd_control_level` - Sets the [Crowd Control](https://support.reddithelp.com/hc/en-us/articles/15484545006996-Crowd-Control) level of a submission. Valid values are `OFF`, `LENIENT`, `MEDIUM`, and `STRICT`.

**For comments (base item only):**

- `action` - A moderation action to perform on the item. Valid values are `approve`, `remove`, `spam`, or `report`
- `report_reason` - If the action is `report`, sets the report reason that will be used. Supports placeholders.

**For users (inside author or crosspost_author sub-group):**

- `set_flair` - Takes either a single string, a list of two strings or a dictionary. If given a single string, the submission's flair text will be set to the string. If given two strings, the first string will be used for the flair text, and the second string for the flair css class. If given a dictionary, the keys will be one of 'text', 'css_class', or 'template_id'. If set, the value of 'text' will be used for the flair text and the value of 'css_class' will be used for the css class. When using the dictionary syntax, 'template_id' must be set, and the value of 'template_id' will be used to set the flair template (template Ids are accessible in Post Flair and User Flair sections of Mod Tools).
- `overwrite_flair` - true/false - If true, a `set_flair` action will overwrite any previous user flair. If false (same as default behavior), any existing flair will not be overwritten.

## Other directives

- `ignore_blockquotes` - true/false - If set to true, any text inside blockquotes will not be considered by this rule when doing search checks against `body`, or counting length with `body_shorter_than`/`body_longer_than`.

## Placeholders

When used inside a string that supports placeholders, these will be replaced with the appropriate value. For crossposts, the `{{body}}`, `{{domain}}`, and `{{url}}` are replaced by the value of the original submission. This allows including information about a post or its author in modmail or report reasons, setting flair to something based on the post that triggered it to be set, etc.

- `{{author}}` - the author's name (do `/u/{{author}}` for a link to the author's user page)
- `{{author_flair_text}}` - the author's flair text (will be replaced with nothing if they have no flair set, or have it disabled)
- `{{author_flair_css_class}}` - the author's flair CSS class (will be replaced with nothing if they have no flair set, or have it disabled)
- `{{author_flair_template_id}}` - the author's template id (will be replaced with nothing if they have no flair set, or have it disabled)
- `{{body}}` - the full body text of the text submission or comment
- `{{permalink}}` - a link to the item
- `{{subreddit}}` - the subreddit's name (do `/r/{{subreddit}}` for a link to the subreddit)
- `{{kind}}` - replaced with "submission" for submissions or "comment" for comments
- `{{title}}` - the submission's title
- `{{domain}}` - the submission's domain
- `{{url}}` - the submission's full url

### Media placeholders

Note that if you use a media placeholder anywhere in a rule, it will make it so that the rule is not applied to any objects where this data is not available.

- `{{media_author}}` - the media's author username
- `{{media_author_url}}` - the media's author url
- `{{media_title}}` - the media's title
- `{{media_description}}` - the media's description

### Match placeholders

There is also one other special type of placeholder that can be used to show information about which words/phrases were matched by a search check on the base item (not search checks inside a sub-group like `author:` or `parent_submission:`). In its most basic form it is simply `{{match}}` and will be replaced with whichever option in your search check matched something in the item. For example, this condition would give a submission a flair css class corresponding to the color that they use in their title:

    title: ["red", "green", "blue"]
    set_flair: ["", "{{match}}"]

In the case of multiple search checks, you must specify which check to take the match from, or you may end up with unexpected behavior. For example, if the same rule also includes a search on `domain`, you should specify that you want the match from the `title` search with `{{match-title}}`:

    title: ["red", "green", "blue"]
    domain: [youtube.com, youtu.be]
    set_flair: ["", "{{match-title}}"]

And finally, it is also possible to use the match placeholder to specify individual capture groups from a regular expression search check. This is done by adding the number of the capture group at the end of the placeholder, but be aware that `{{match}}` is the same as `{{match-1}}`, and will be replaced with the entire matched word/phrase. Capture groups defined inside your regex with parentheses start at `{{match-2}}`. You can also specify the specific search match along with this, such as `{{match-title-2}}`.

## Standard conditions

Standard conditions allow you to make use of some pre-defined checks such as "image hosting sites" and "video hosting sites" that maintain a list of common domains, so that you do not need to manually define your own list. To use a standard condition, simply define `standard:` along with the check's name. **You can only define a single standard condition inside a rule**. For example, to remove submissions from common image hosts:

    standard: image hosting sites
    action: remove

The available standard conditions are:

- `image hosting sites` - will match link submissions from common image hosting domains
- `direct image links` - will match link submissions that link directly to image files (PNG, JPG, GIF, GIFV)
- `video hosting sites` - will match link submissions from common video hosting domains
- `streaming sites` - will match link submissions from common streaming domains
- `crowdfunding sites` - will match link submissions from common crowdfunding domains
- `meme generator sites` - will match link submissions from common meme-generator sites
- `facebook links` - will match submissions or comments including links to Facebook
- `amazon affiliate links` - will match submissions or comments including Amazon links with an affiliate code

If you want to look at the specifics of what a particular standard condition will match, the definitions are available for reference on [the standard conditions page](https://www.reddit.com/wiki/automoderator/standard-conditions).
