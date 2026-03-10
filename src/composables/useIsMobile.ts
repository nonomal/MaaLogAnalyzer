import { ref } from 'vue'
import type { Ref } from 'vue'

const MOBILE_BREAKPOINT = '(max-width: 768px)'

const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT)
const isMobile = ref(mediaQuery.matches)

mediaQuery.addEventListener('change', (e) => {
  isMobile.value = e.matches
})

export function useIsMobile(): { isMobile: Ref<boolean> } {
  return { isMobile }
}
