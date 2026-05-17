import { useProcessFileSelection } from './processView/fileSelection'
import { useProcessFollowNav } from './processView/followNav'
import { useProcessRuntimeLayout } from './processView/runtimeLayout'
import type { ProcessViewControllerEmitters, ProcessViewControllerProps } from './processView/types'
import type { PrimaryLogSelectionOption } from '../../../utils/logFileDiscovery'

interface UseProcessViewControllerOptions {
  props: ProcessViewControllerProps
  emitters: ProcessViewControllerEmitters
  selectPrimaryLogs?: (options: PrimaryLogSelectionOption[]) => Promise<PrimaryLogSelectionOption[] | null>
}

export const useProcessViewController = (
  options: UseProcessViewControllerOptions,
) => {
  const runtimeLayout = useProcessRuntimeLayout(options.props)
  const followNav = useProcessFollowNav({
    props: options.props,
    emitters: options.emitters,
    isRealtimeStreaming: runtimeLayout.isRealtimeStreaming,
  })
  const fileSelection = useProcessFileSelection({
    emitters: options.emitters,
    isInTauri: runtimeLayout.isInTauri,
    isInVSCode: runtimeLayout.isInVSCode,
    virtualScroller: followNav.virtualScroller,
    selectPrimaryLogs: options.selectPrimaryLogs,
  })

  return {
    ...runtimeLayout,
    ...followNav,
    ...fileSelection,
  }
}
