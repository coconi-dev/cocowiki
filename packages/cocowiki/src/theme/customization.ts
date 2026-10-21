import type { Component, InjectionKey } from 'vue'
import type { ThemeComponentName } from '../shared/extensions'
export { themeComponentNames, type ThemeComponentName } from '../shared/extensions'

export type CocoWikiThemeComponentOverrides = Partial<Record<ThemeComponentName, Component>>

export const cocoWikiThemeComponentsKey: InjectionKey<CocoWikiThemeComponentOverrides> = Symbol('cocowiki-theme-components')
