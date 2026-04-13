import { createApp } from 'vue'
import Index from './Index.vue'
import './style.css'
import { reportAnalyticsContext } from './utils/analytics'
import { installVueLogParserRuntime } from './utils/logParserVueRuntime'

installVueLogParserRuntime()

const app = createApp(Index)
app.mount('#app')

reportAnalyticsContext()
