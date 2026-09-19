import type { Component, InjectionKey } from 'vue'

export interface CocoWikiThemeComponentOverrides {
  Header?: Component
  Home?: Component
  Search?: Component
  Archive?: Component
  Contributors?: Component
  PageMeta?: Component
  PageOutline?: Component
  ContentSidebar?: Component
  PageNavigation?: Component
  PageFooter?: Component
  SearchOverlay?: Component
  Loading?: Component
  NotFound?: Component
}

export const cocoWikiThemeComponentsKey: InjectionKey<CocoWikiThemeComponentOverrides> = Symbol('cocowiki-theme-components')
