import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import ContributorList from './components/ContributorList.vue'
import './styles.css'

export { registerContributorContributions, useContributorContributionSources } from './contributors'

export default {
  Layout,
  enhanceApp({ app }) {
    app.component('ContributorList', ContributorList)
  }
} satisfies Theme
