declare module 'vue-virtual-scroller' {
  import { DefineComponent, SlotsType } from 'vue'

  interface DynamicScrollerSlotProps {
    item: any
    index: number
    active: boolean
  }

  interface DynamicScrollerExposed {
    scrollToItem(index: number): void
  }

  export const DynamicScroller: DefineComponent<
    {
      items?: any[]
      minItemSize?: number
      keyField?: string
    },
    DynamicScrollerExposed,
    {},
    {},
    {},
    {},
    {},
    {},
    string,
    {},
    {},
    {},
    SlotsType<{
      default: DynamicScrollerSlotProps; after?: any; before?: any
    }>
  >

  export const DynamicScrollerItem: DefineComponent<{
    item?: any
    active?: boolean
    sizeDependencies?: any[]
  }>

  export const RecycleScroller: DefineComponent<any, any, any>
}
