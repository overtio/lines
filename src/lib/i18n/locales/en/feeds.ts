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
  "feeds.opml": "Subscriptions",
  "feeds.opmlNote": "As an OPML file, which other feed readers and podcast apps import and export.",
  "feeds.importOpml": "Import OPML…",
  "feeds.exportOpml": "Export OPML",
  "feeds.importing": "Importing…",
  "feeds.imported": "{count, plural, =0 {No feeds that aren’t subscribed to already} one {Subscribed to # feed} other {Subscribed to # feeds}}",
};
