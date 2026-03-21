<script setup lang="ts">
import { computed } from 'vue'
import { NCard, NButton, NFlex, NTag, NImage, NText } from 'naive-ui'
import { CheckCircleOutlined, CloseCircleOutlined } from '@vicons/antd'
import type { NodeInfo, MergedRecognitionItem, RecognitionAttempt, UnifiedFlowItem } from '../types'
import { isTauri } from '../utils/platform'
import {
  buildNodeActionLevelRecognitionItems,
  buildNodeRecognitionAttempts,
  buildNodeTaskFlowItems,
} from '../utils/nodeFlow'

const convertFileSrc = (filePath: string) => {
  if (!isTauri()) return filePath
  return `https://asset.localhost/${filePath.replace(/\\/g, '/')}`
}

const emit = defineEmits<{
  'select-node': [node: NodeInfo]
  'select-action': [node: NodeInfo]
  'select-recognition': [node: NodeInfo, attemptIndex: number]
  'select-nested': [node: NodeInfo, attemptIndex: number, nestedIndex: number]
  'select-nested-action': [node: NodeInfo, actionIndex: number, nestedIndex: number]
  'select-action-recognition': [node: NodeInfo, attemptIndex: number]
  'select-nested-action-recognition': [node: NodeInfo, actionIndex: number, nestedIndex: number, attemptIndex: number]
  'select-flow-item': [node: NodeInfo, flowItemId: string]
  'toggle-recognition': []
  'toggle-action': []
  'toggle-nested': [attemptIndex: number]
}>()

const props = defineProps<{
  node: NodeInfo
  mergedRecognitionList: MergedRecognitionItem[]
  recognitionExpanded: boolean
  actionExpanded: boolean
  isExpanded: (attemptIndex: number) => boolean
  getButtonType: (status: string) => 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
  actionButtonType: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'
}>()

const dedupeRecognitionAttempts = (items: RecognitionAttempt[]) => {
  const seen = new Set<string>()
  const result: RecognitionAttempt[] = []
  for (const item of items) {
    const key = `${item.reco_id}|${item.name}|${item.ts}|${item.status}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

interface FlattenedNestedRecognition {
  attempt: RecognitionAttempt
  flowItemId: string
  depth: number
}

interface TaskGroupItem {
  groupIdx: number
  taskId: number
  flowItemId: string
  name: string
  ts: string
  status: 'success' | 'failed'
  actions: Array<{
    groupIdx: number
    nestedIdx: number
    flowItemId: string
    nested: {
      name: string
      status: 'success' | 'failed'
      action_details?: any
    }
    recognitionItems: Array<{
      flowItemId: string
      attempt: RecognitionAttempt
    }>
  }>
}

const flattenNestedRecognitionNodes = (
  attempts: RecognitionAttempt[] | undefined,
  parentFlowItemId: string,
  depth = 1
): FlattenedNestedRecognition[] => {
  if (!attempts || attempts.length === 0) return []

  const result: FlattenedNestedRecognition[] = []
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]
    const flowItemId = `${parentFlowItemId}.nested.${i}`
    result.push({
      attempt,
      flowItemId,
      depth,
    })
    if (attempt.nested_nodes && attempt.nested_nodes.length > 0) {
      result.push(...flattenNestedRecognitionNodes(attempt.nested_nodes, flowItemId, depth + 1))
    }
  }
  return result
}

const getFlowItemRecoId = (item: UnifiedFlowItem): number => {
  if (typeof item.reco_id === 'number') return item.reco_id
  return typeof item.reco_details?.reco_id === 'number' ? item.reco_details.reco_id : 0
}

const toRecognitionAttemptFromFlowItem = (item: UnifiedFlowItem): RecognitionAttempt => ({
  reco_id: getFlowItemRecoId(item),
  name: item.name,
  ts: item.ts,
  end_ts: item.end_ts,
  status: item.status,
  reco_details: item.reco_details,
  error_image: item.error_image,
  vision_image: item.vision_image,
  nested_nodes: undefined
})

const toRecognitionItemsFromFlowChildren = (item: UnifiedFlowItem) => {
  const children = item.children ?? []
  return children
    .filter(child => child.type === 'recognition' || child.type === 'recognition_node')
    .map(child => ({
      flowItemId: child.id,
      attempt: toRecognitionAttemptFromFlowItem(child),
    }))
}

const recognitionAttempts = computed(() => buildNodeRecognitionAttempts(props.node))
const actionLevelRecoItems = computed(() => buildNodeActionLevelRecognitionItems(props.node))
const taskFlowItems = computed(() => buildNodeTaskFlowItems(props.node))

const actionTree = computed(() => {
  return {
    actionLevelReco: dedupeRecognitionAttempts(
      actionLevelRecoItems.value.map(toRecognitionAttemptFromFlowItem)
    ),
  }
})

const taskGroups = computed<TaskGroupItem[]>(() => {
  const taskItems = taskFlowItems.value
  if (taskItems.length === 0) return []
  return taskItems.map((group, groupIdx) => ({
    groupIdx,
    taskId: group.task_id || 0,
    flowItemId: group.id,
    name: group.name,
    ts: group.ts,
    status: group.status,
    actions: (group.children ?? [])
      .filter(item => item.type === 'pipeline_node')
      .map((nested, nestedIdx) => ({
        groupIdx,
        nestedIdx,
        flowItemId: nested.id,
        nested: {
          name: nested.name,
          status: nested.status,
          action_details: nested.action_details,
        },
        recognitionItems: toRecognitionItemsFromFlowChildren(nested),
      })),
  }))
})

const hasRecognitionSection = computed(() => {
  return props.mergedRecognitionList.length > 0 || actionTree.value.actionLevelReco.length > 0
})

const hasTaskSection = computed(() => {
  return taskGroups.value.length > 0
})

const hasActionSection = computed(() => {
  return !!props.node.action_details
})

const toTimestampMs = (timestamp?: string): number => {
  if (!timestamp) return Number.POSITIVE_INFINITY
  const normalized = timestamp.includes(' ') ? timestamp.replace(' ', 'T') : timestamp
  const parsed = Date.parse(normalized)
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

const pickEarliest = (timestamps: Array<string | undefined>): number => {
  const values = timestamps.map(toTimestampMs).filter(value => Number.isFinite(value))
  return values.length > 0 ? Math.min(...values) : Number.POSITIVE_INFINITY
}

const sectionOrder = computed<Array<'recognition' | 'task' | 'action'>>(() => {
  const sections: Array<{ type: 'recognition' | 'task' | 'action'; ts: number }> = []

  if (hasRecognitionSection.value) {
    const recoTimestamps = [
      ...recognitionAttempts.value.map(attempt => attempt.ts),
      ...actionTree.value.actionLevelReco.map(attempt => attempt.ts),
    ]
    sections.push({
      type: 'recognition',
      ts: pickEarliest(recoTimestamps),
    })
  }

  if (hasTaskSection.value) {
    const taskTimestamps = taskGroups.value.map(group => group.ts)
    sections.push({
      type: 'task',
      ts: pickEarliest(taskTimestamps),
    })
  }

  if (hasActionSection.value) {
    const actionTs = pickEarliest([
      props.node.action_details?.ts,
      props.node.action_details?.end_ts,
    ])
    sections.push({
      type: 'action',
      ts: Number.isFinite(actionTs)
        ? actionTs
        : pickEarliest([props.node.end_ts, props.node.ts]),
    })
  }

  return sections
    .sort((a, b) => a.ts - b.ts)
    .map(section => section.type)
})
</script>

<template>
  <template v-for="section in sectionOrder" :key="section">
    <n-card v-if="section === 'recognition'" size="small">
      <template #header>
        <n-flex align="center" style="gap: 8px">
          <span>Recognition</span>
          <n-button size="small" @click="emit('toggle-recognition')">
            {{ recognitionExpanded ? 'Hide' : 'Show' }}
          </n-button>
        </n-flex>
      </template>

      <n-flex vertical style="gap: 8px">
        <template v-for="(item, idx) in mergedRecognitionList" :key="`merged-${idx}`">
          <n-text
            v-if="item.isRoundSeparator && recognitionExpanded"
            depth="3"
            class="round-separator"
          >
            {{ item.name }}
          </n-text>

          <n-button
            v-else-if="recognitionExpanded && item.status === 'not-recognized'"
            size="small"
            type="default"
            ghost
            disabled
            style="align-self: flex-start; opacity: 0.5"
          >
            {{ item.name }}
          </n-button>

          <n-flex
            v-else-if="!item.hasNestedNodes && (recognitionExpanded || item.status === 'success')"
            :key="`simple-${idx}`"
            vertical
            style="gap: 8px; align-items: flex-start"
          >
            <n-button
              size="small"
              :type="getButtonType(item.status)"
              ghost
              @click="emit('select-recognition', node, item.attemptIndex!)"
            >
              <template #icon>
                <check-circle-outlined v-if="item.status === 'success'" />
                <close-circle-outlined v-else />
              </template>
              {{ item.name }}
            </n-button>
            <n-image
              v-if="item.attempt?.vision_image"
              :src="convertFileSrc(item.attempt.vision_image)"
              width="200"
              style="border-radius: 4px"
            />
            <n-image
              v-if="item.attempt?.error_image"
              :src="convertFileSrc(item.attempt.error_image)"
              width="200"
              style="border-radius: 4px"
            />
          </n-flex>

          <template v-else-if="recognitionExpanded || item.status === 'success'">
            <n-card v-if="isExpanded(item.attemptIndex!)" :key="`nested-card-${item.attemptIndex}`" size="small">
              <template #header>
                <n-flex align="center" style="gap: 8px">
                  <n-button
                    size="small"
                    :type="getButtonType(item.status)"
                    ghost
                    @click="emit('select-recognition', node, item.attemptIndex!)"
                  >
                    <template #icon>
                      <check-circle-outlined v-if="item.status === 'success'" />
                      <close-circle-outlined v-else />
                    </template>
                    {{ item.name }}
                  </n-button>
                  <n-button size="small" @click="emit('toggle-nested', item.attemptIndex!)">
                    Hide
                  </n-button>
                </n-flex>
              </template>

              <n-flex vertical style="gap: 12px">
                <n-image
                  v-if="item.attempt?.vision_image"
                  :src="convertFileSrc(item.attempt.vision_image)"
                  width="200"
                  style="border-radius: 4px"
                />
                <n-image
                  v-if="item.attempt?.error_image"
                  :src="convertFileSrc(item.attempt.error_image)"
                  width="200"
                  style="border-radius: 4px"
                />
                <n-flex wrap style="gap: 8px 12px">
                  <n-button
                    v-for="nested in flattenNestedRecognitionNodes(item.attempt!.nested_nodes, `node.recognition.${item.attemptIndex!}`)"
                    :key="`nested-${item.attemptIndex}-${nested.flowItemId}`"
                    size="small"
                    :type="nested.attempt.status === 'success' ? 'success' : 'warning'"
                    ghost
                    :style="{ marginLeft: `${(nested.depth - 1) * 12}px` }"
                    @click="emit('select-flow-item', node, nested.flowItemId)"
                  >
                    <template #icon>
                      <check-circle-outlined v-if="nested.attempt.status === 'success'" />
                      <close-circle-outlined v-else />
                    </template>
                    {{ nested.attempt.name }}
                  </n-button>
                </n-flex>
              </n-flex>
            </n-card>

            <n-flex v-else :key="`collapsed-${idx}`" vertical style="gap: 8px; align-items: flex-start">
              <n-flex align="center" style="gap: 8px">
                <n-button
                  size="small"
                  :type="getButtonType(item.status)"
                  ghost
                  @click="emit('select-recognition', node, item.attemptIndex!)"
                >
                  <template #icon>
                    <check-circle-outlined v-if="item.status === 'success'" />
                    <close-circle-outlined v-else />
                  </template>
                  {{ item.name }}
                </n-button>
                <n-button size="small" @click="emit('toggle-nested', item.attemptIndex!)">
                  Show
                </n-button>
              </n-flex>
              <n-image
                v-if="item.attempt?.vision_image"
                :src="convertFileSrc(item.attempt.vision_image)"
                width="200"
                style="border-radius: 4px"
              />
              <n-image
                v-if="item.attempt?.error_image"
                :src="convertFileSrc(item.attempt.error_image)"
                width="200"
                style="border-radius: 4px"
              />
            </n-flex>
          </template>
        </template>

        <n-card
          v-if="recognitionExpanded && actionTree.actionLevelReco.length > 0"
          size="small"
          title="Action 内 Recognition"
        >
          <n-flex wrap style="gap: 8px">
            <n-button
              v-for="(attempt, attemptIdx) in actionTree.actionLevelReco"
              :key="`action-level-reco-${attemptIdx}`"
              size="small"
              :type="attempt.status === 'success' ? 'success' : 'warning'"
              ghost
              @click="emit('select-action-recognition', node, attemptIdx)"
            >
              <template #icon>
                <check-circle-outlined v-if="attempt.status === 'success'" />
                <close-circle-outlined v-else />
              </template>
              {{ attempt.name }}
            </n-button>
          </n-flex>
        </n-card>
      </n-flex>
    </n-card>

    <n-card v-else-if="section === 'task'" size="small">
      <template #header>
        <n-flex align="center" style="gap: 8px">
          <span>Task</span>
          <n-button size="small" @click="emit('toggle-action')">
            {{ actionExpanded ? 'Hide' : 'Show' }}
          </n-button>
        </n-flex>
      </template>

      <n-flex v-if="actionExpanded" vertical style="gap: 12px">
        <n-card
          v-for="group in taskGroups"
          :key="`task-group-${group.groupIdx}-${group.taskId}`"
          size="small"
        >
          <template #header>
            <n-flex justify="space-between" align="center">
              <n-button
                size="small"
                :type="group.status === 'success' ? 'success' : 'error'"
                ghost
                @click="emit('select-flow-item', node, group.flowItemId)"
              >
                {{ group.name }}
              </n-button>
              <n-tag size="small" :type="group.status === 'success' ? 'success' : 'error'">
                {{ group.status === 'success' ? '成功' : '失败' }}
              </n-tag>
            </n-flex>
          </template>

          <n-flex vertical style="gap: 10px">
            <n-card
              v-for="(item, idx) in group.actions"
              :key="`nested-action-${group.groupIdx}-${idx}`"
              size="small"
            >
              <template #header>
                <n-flex justify="space-between" align="center">
                  <n-button
                    size="small"
                    @click="emit('select-flow-item', node, item.flowItemId)"
                  >
                    {{ item.nested.name }}
                  </n-button>
                  <n-tag size="small" :type="item.nested.status === 'success' ? 'success' : 'error'">
                    {{ item.nested.status === 'success' ? '成功' : '失败' }}
                  </n-tag>
                </n-flex>
              </template>

              <n-flex vertical style="gap: 8px">
                <n-card v-if="item.recognitionItems.length > 0" size="small" title="Recognition">
                  <n-flex wrap style="gap: 8px">
                    <n-button
                      v-for="(entry, attemptIdx) in item.recognitionItems"
                      :key="`nested-reco-${group.groupIdx}-${idx}-${attemptIdx}`"
                      size="small"
                      :type="entry.attempt.status === 'success' ? 'success' : 'warning'"
                      ghost
                      @click="emit('select-flow-item', node, entry.flowItemId)"
                    >
                      <template #icon>
                        <check-circle-outlined v-if="entry.attempt.status === 'success'" />
                        <close-circle-outlined v-else />
                      </template>
                      {{ entry.attempt.name }}
                    </n-button>
                  </n-flex>
                </n-card>

                <n-card size="small" title="Action">
                  <n-button
                    v-if="item.nested.action_details"
                    size="small"
                    :type="item.nested.action_details.success ? 'success' : 'error'"
                    ghost
                    @click="emit('select-flow-item', node, item.flowItemId)"
                  >
                    <template #icon>
                      <check-circle-outlined v-if="item.nested.action_details.success" />
                      <close-circle-outlined v-else />
                    </template>
                    {{ item.nested.action_details.name }}
                  </n-button>
                  <n-flex v-else align="center" style="gap: 8px">
                    <n-tag size="small" type="default">No action detail</n-tag>
                    <n-button
                      size="tiny"
                      ghost
                      @click="emit('select-flow-item', node, item.flowItemId)"
                    >
                      查看节点
                    </n-button>
                  </n-flex>
                </n-card>
              </n-flex>
            </n-card>

            <n-flex v-if="group.actions.length === 0" align="center" style="gap: 8px">
              <n-tag size="small" type="default">No nested action</n-tag>
            </n-flex>
          </n-flex>
        </n-card>
      </n-flex>
    </n-card>

    <n-card v-else-if="section === 'action'" size="small" title="Action">
      <n-button
        size="small"
        :type="actionButtonType"
        ghost
        @click="emit('select-action', node)"
      >
        <template #icon>
          <check-circle-outlined v-if="actionButtonType === 'success'" />
          <close-circle-outlined v-else />
        </template>
        {{ node.action_details!.name }}
      </n-button>
    </n-card>
  </template>
</template>

<style scoped>
.round-separator {
  display: block;
  width: 100%;
  padding: 4px 0;
  text-align: center;
  font-size: 12px;
  letter-spacing: 0.5px;
}
</style>
