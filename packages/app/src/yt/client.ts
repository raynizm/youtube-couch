// The YouTube client, split by concern. Import from here; the modules below are its internals.
export { listProfiles, selectProfile } from './account'
export { curatedHome } from './home'
export { toItem, toVideos } from './items'
export { accountHistory, accountHome, accountPlaylists, getPlaylistVideos, HISTORY_SIZE, historyFeed, subscriptionRows, subscriptionsFeed } from './library'
export { search, searchFeed } from './search'
export { signOut, startSignIn, type SignInCode } from './session'
export { fetchRange, getAdaptiveStream, getCaptions, getChannelVideos, getDetails, getPreviewClip, getStream, toDetails, type PreviewClip } from './video'
