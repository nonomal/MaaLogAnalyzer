<script setup lang="ts">
import { NFlex, NButton, NIcon, NDropdown, NText } from 'naive-ui'
import {
  BarChartOutlined,
  FileSearchOutlined,
  DashboardOutlined,
  ApartmentOutlined,
  ColumnHeightOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  BulbFilled,
  BulbOutlined,
} from '@vicons/antd'
import { isVSCode } from '../../../../utils/platform'

defineProps<{
  currentViewLabel: string
  viewMode: string
  viewModeOptions: Array<Record<string, unknown>>
  isVscodeLaunchEmbed: boolean
  isDark: boolean
}>()

const emit = defineEmits<{
  'select-view-mode': [key: string]
  'open-settings': []
  'open-about': []
  'toggle-theme': []
}>()

const handleViewModeSelect = (key: string | number) => {
  emit('select-view-mode', String(key))
}

const isNativeVSCodeHost = isVSCode()
</script>

<template>
  <n-flex justify="space-between" align="center">
    <n-flex align="center" style="gap: 12px">
      <n-text strong style="font-size: 16px">MAA 日志工具</n-text>

      <div data-tour="header-view-switch">
        <n-dropdown
          :options="viewModeOptions"
          @select="handleViewModeSelect"
          trigger="click"
        >
          <n-button size="small">
            <template #icon>
              <n-icon>
                <bar-chart-outlined v-if="viewMode === 'analysis'" />
                <file-search-outlined v-else-if="viewMode === 'search'" />
                <dashboard-outlined v-else-if="viewMode === 'statistics'" />
                <apartment-outlined v-else-if="viewMode === 'flowchart'" />
                <column-height-outlined v-else />
              </n-icon>
            </template>
            {{ currentViewLabel }}
          </n-button>
        </n-dropdown>
      </div>
    </n-flex>

    <n-flex align="center" style="gap: 8px">
      <n-button
        text
        style="font-size: 20px"
        data-tour="header-settings-button"
        @click="emit('open-settings')"
      >
        <n-icon>
          <setting-outlined />
        </n-icon>
      </n-button>

      <n-button
        text
        style="font-size: 20px"
        @click="emit('open-about')"
      >
        <n-icon>
          <info-circle-outlined />
        </n-icon>
      </n-button>

      <n-button
        v-if="!isVscodeLaunchEmbed && !isNativeVSCodeHost"
        text
        style="font-size: 20px"
        data-tour="header-theme-button"
        @click="emit('toggle-theme')"
      >
        <n-icon>
          <bulb-filled v-if="isDark" />
          <bulb-outlined v-else />
        </n-icon>
      </n-button>
    </n-flex>
  </n-flex>
</template>
