import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { NodeInfo, UnifiedFlowItem } from '../../../types'
import { useMergedRecognitionList } from '../useMergedRecognitionList'

const makeRecognitionFlowItem = (
  index: number,
  name: string,
  status: 'success' | 'failed' | 'running',
  timestamp: string
): UnifiedFlowItem => {
  return {
    id: `node.recognition.${index}`,
    type: 'recognition',
    name,
    status,
    ts: timestamp,
    end_ts: timestamp,
    reco_id: 1000 + index,
  }
}

const makeNode = (overrides: Partial<NodeInfo> = {}): NodeInfo => {
  return {
    node_id: 1,
    name: 'Root',
    ts: '2026-04-06 00:00:00.000',
    end_ts: '2026-04-06 00:00:01.000',
    status: 'success',
    task_id: 1,
    next_list: [],
    ...overrides,
  }
}

describe('useMergedRecognitionList', () => {
  it('keeps original recognition attempt order when next_list is empty', () => {
    const nodeRef = ref(makeNode({
      node_flow: [
        makeRecognitionFlowItem(0, 'A', 'failed', '2026-04-06 00:00:00.100'),
        makeRecognitionFlowItem(1, 'B', 'success', '2026-04-06 00:00:00.200'),
      ],
    }))
    const showNotRecognizedNodes = ref(true)

    const { visibleRecognitionList } = useMergedRecognitionList({
      node: nodeRef,
      showNotRecognizedNodes,
    })

    expect(visibleRecognitionList.value).toMatchObject([
      { name: 'A', status: 'failed', attemptIndex: 0 },
      { name: 'B', status: 'success', attemptIndex: 1 },
    ])
  })

  it('splits multi-round attempts and filters placeholders by settings', () => {
    const nodeRef = ref(makeNode({
      next_list: [
        { name: 'A', anchor: false, jump_back: false },
        { name: 'B', anchor: false, jump_back: false },
      ],
      node_flow: [
        makeRecognitionFlowItem(0, 'A', 'failed', '2026-04-06 00:00:00.100'),
        makeRecognitionFlowItem(1, 'B', 'success', '2026-04-06 00:00:00.200'),
        makeRecognitionFlowItem(2, 'A', 'failed', '2026-04-06 00:00:00.300'),
      ],
    }))
    const showNotRecognizedNodes = ref(true)

    const { visibleRecognitionList } = useMergedRecognitionList({
      node: nodeRef,
      showNotRecognizedNodes,
    })

    expect(visibleRecognitionList.value).toMatchObject([
      { isRoundSeparator: true, roundIndex: 1 },
      { name: 'A', status: 'failed', attemptIndex: 0 },
      { name: 'B', status: 'success', attemptIndex: 1 },
      { isRoundSeparator: true, roundIndex: 2 },
      { name: 'A', status: 'failed', attemptIndex: 2 },
      { name: 'B', status: 'not-recognized' },
    ])

    showNotRecognizedNodes.value = false

    expect(visibleRecognitionList.value).toMatchObject([
      { isRoundSeparator: true, roundIndex: 1 },
      { name: 'A', status: 'failed', attemptIndex: 0 },
      { name: 'B', status: 'success', attemptIndex: 1 },
      { isRoundSeparator: true, roundIndex: 2 },
      { name: 'A', status: 'failed', attemptIndex: 2 },
    ])
    expect(
      visibleRecognitionList.value
        .filter(item => !item.isRoundSeparator)
        .some(item => item.status === 'not-recognized')
    ).toBe(false)
  })

  it('hides pure not-recognized list when placeholders are disabled', () => {
    const nodeRef = ref(makeNode({
      next_list: [
        { name: 'X', anchor: false, jump_back: false },
        { name: 'Y', anchor: false, jump_back: false },
      ],
      node_flow: [],
    }))
    const showNotRecognizedNodes = ref(false)

    const { visibleRecognitionList } = useMergedRecognitionList({
      node: nodeRef,
      showNotRecognizedNodes,
    })

    expect(visibleRecognitionList.value).toEqual([])
  })
})
