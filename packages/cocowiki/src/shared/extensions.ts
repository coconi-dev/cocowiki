/** The only list of public component override names. Defaults are checked against this union. */
export const themeComponentNames = ['Header', 'Home', 'Search', 'Archive', 'Contributors', 'PageMeta', 'PageOutline', 'ContentSidebar', 'PageNavigation', 'PageStatus', 'PageRelations', 'PageFooter', 'SearchOverlay', 'Loading', 'NotFound'] as const
export type ThemeComponentName = typeof themeComponentNames[number]
