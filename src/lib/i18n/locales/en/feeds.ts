/** Feeds: subscribing, the reader's list and its posts, and refreshing. */
export default {
  // The Library's row of every feed's posts, and the list's title there.
  "feeds.title": "Feeds",
  // One subscription, as a kind of note in the Library (a site's, not a podcast's).
  "feeds.feed": "Feed",
  // The button that shows the feeds subscribed to, nested under Feeds.
  "feeds.showSubscriptions": "Show feeds",
  "feeds.unreadCount": "{count, plural, one {# unread} other {# unread}}",
  // A feed's menu (and Feeds' own).
  "feeds.readAll": "Mark All as Read",
  "feeds.didReadAll": "Marked all as read",
  "feeds.openNote": "Open Its Note",
  "feeds.copyFeedLink": "Copy Feed Link",
  // A feed's menu, for one whose note has no picture: its artwork, or its site's icon; and what's said after.
  "feeds.getPicture": "Get Its Picture",
  "feeds.gotPicture": "{title} has its picture.",
  "feeds.noPicture": "There’s no picture for {title}.",
  // A kind of feeds' row's menu, while some of its sites' feeds have no picture; and what's said after.
  "feeds.getPictures": "Get Missing Pictures",
  "feeds.gotPictures": "{count, plural, =0 {No pictures found} one {Found a picture for # feed} other {Found pictures for # feeds}}",
  "feeds.unsubscribe": "Unsubscribe",
  "feeds.unsubscribed": "Unsubscribed from {title}. Its note is in the Trash.",
  "feeds.refresh": "Refresh Feeds",
  "feeds.refreshOne": "Refresh Feed",
  "feeds.subscribe": "Subscribe to a Feed",
  // The box to subscribe in: its heading, its field and its button.
  "feeds.subscribeTitle": "Subscribe to a feed",
  "feeds.linkLabel": "Link to a feed, a site or a podcast on Apple Podcasts",
  "feeds.linkPlaceholder": "Feed, site or Apple Podcasts link",
  "feeds.subscribeButton": "Subscribe",
  // Said by screen readers while the feed is looked for, and once it's found.
  "feeds.finding": "Looking for the feed…",
  "feeds.subscribed": "Subscribed to {title}",
  "feeds.noFeedThere": "There’s no feed there that lines can read.",
  // On the web app, in the box to subscribe in and over the list when a feed couldn't be read.
  "feeds.webHint": "On the web, lines can read only the feeds whose sites allow it. The desktop apps read them all.",
  // The list of posts, when there are none to show.
  "feeds.none": "No feeds yet.",
  "feeds.noPosts": "No posts yet.",
  "feeds.fetching": "Fetching…",
  "feeds.noMatches": "No posts match “{query}”.",
  // Why a feed couldn't be fetched, over its posts and in its row's tooltip.
  "feeds.errorBlocked": "This feed’s site doesn’t let web pages read it. The desktop apps can.",
  "feeds.errorLocal": "It leads to an address on this computer or its network, which lines doesn’t follow from the web.",
  "feeds.errorTimeout": "The feed took too long to answer.",
  "feeds.errorTooBig": "The feed is too big to read.",
  "feeds.errorNotFeed": "There’s no feed at this address any more.",
  "feeds.errorGone": "The feed is gone for good, its site says. It’s fetched again only when you refresh it.",
  "feeds.errorStatus": "The feed’s site answered with an error ({status}).",
  "feeds.errorOther": "The feed couldn’t be fetched: {error}",
  // A post in the list, as screen readers hear it.
  "feeds.unread": "unread",
  "feeds.episode": "episode",
  // A post's menu, and the buttons over an open one.
  "feeds.markRead": "Mark as Read",
  "feeds.markUnread": "Mark as Unread",
  "feeds.didRead": "Marked as read",
  "feeds.didUnread": "Marked as unread",
  // A link to where a post is talked about (its comments' page), under its title.
  "feeds.comments": "Comments",
  "feeds.openInBrowser": "Open in Browser",
  // A post's discussion, read under it where a plugin reads its comments link (Hacker News'): its heading, how many comments, where they're from.
  "feeds.discussion.count": "{count, plural, one {# comment} other {# comments}}",
  "feeds.discussion.openOn": "Open on {site}",
  "feeds.discussion.loading": "Loading comments…",
  "feeds.discussion.failed": "The comments couldn’t be loaded.",
  "feeds.discussion.retry": "Try Again",
  "feeds.discussion.none": "No comments yet.",
  // The site counts comments, but has none to give yet (Hacker News' copy of a story posted a moment ago).
  "feeds.discussion.notYet": "The comments aren’t here yet. They’re on {site}.",
  // Comments the site counts that it didn't give (taken down with what they answer, or too new), linking to them there.
  "feeds.discussion.missing": "{count, plural, one {# more comment} other {# more comments}} on {site}",
  // A comment folded away: how many replies are folded with it.
  "feeds.discussion.replies": "{count, plural, one {# reply} other {# replies}}",
  // In a reply too deep to be drawn in from the comment it answers: whose that is.
  "feeds.discussion.replyTo": "reply to {name}",
  // After the name of whoever posted what's commented on, for screen readers.
  "feeds.discussion.poster": "who posted it",
  // Said by screen readers with the first comment, where Tab comes into the discussion.
  "feeds.discussion.keys": "Up and down arrows go from comment to comment; left and right fold and unfold them, or go to what one answers and to its replies.",
  // Keeping a post as a note in the Library (an article, or an episode), and opening that note once it is.
  "feeds.save": "Save to Library",
  "feeds.openSaved": "Open in Library",
  "feeds.saved": "Saved “{title}” to the Library",
  "feeds.couldntSave": "The post couldn’t be saved.",
  "feeds.copyLink": "Copy Link",
  // In the note's place, in the Feeds with no post open.
  "feeds.choosePost": "Choose a post to read it.",
  // The open post, as screen readers name it.
  "feeds.postLabel": "Post: {title}",
  "feeds.unreadable": "This post couldn’t be read from this device.",
  // On a phone, the button back from an open post to the list.
  "feeds.back": "Back to posts",
  // The title of the OPML file the feeds are exported in.
  "feeds.opmlTitle": "Feeds from lines",
  // Settings → Library: how often feeds are fetched, and OPML.
  // The Library's rows of feeds, a kind each (Settings → Library → Feeds in the sidebar).
  "feeds.group.rss": "RSS Feeds",
  "feeds.group.atom": "Atom Feeds",
  "feeds.group.json": "JSON Feeds",
  "feeds.group.podcast": "Podcast Feeds",
  "feeds.showGroup": "Show the feeds in {group}",
  "feeds.inSidebar": "Feeds in the sidebar",
  "feeds.inSidebarNote": "By Kind: a row each in the Library for RSS, Atom and podcasts’ feeds (a podcast’s whatever it’s written in). Together: one Feeds row for them all.",
  "feeds.byKind": "By Kind",
  "feeds.together": "Together",
  "feeds.refreshEvery": "Refresh feeds",
  "feeds.refreshEveryNote": "When lines starts, and then this often while it’s open.",
  "feeds.every": "{minutes, plural, =60 {Every hour} =240 {Every 4 hours} other {Every # minutes}}",
  "feeds.onlyWhenAsked": "Only when I ask",
  // In an episode's note as it plays, Enter after a time's item starts the next with the time it's at.
  "feeds.timeNotes": "Time new notes while listening",
  "feeds.timeNotesNote": "In an episode’s note, while it plays or is paused after playing (not one paused before lines opened), Enter after an item of a list of times starts the next with the time the episode is at.",
  "feeds.opml": "Subscriptions",
  "feeds.opmlNote": "As an OPML file, which other feed readers and podcast apps import and export.",
  "feeds.importOpml": "Import OPML…",
  "feeds.exportOpml": "Export OPML",
  "feeds.importing": "Importing…",
  "feeds.imported": "{count, plural, =0 {No feeds that aren’t subscribed to already} one {Subscribed to # feed} other {Subscribed to # feeds}}",
};
