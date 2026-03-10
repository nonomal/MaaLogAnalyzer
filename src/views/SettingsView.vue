<script setup lang="ts">
import { NCard, NForm, NFormItem, NSwitch, NButton, NFlex, NRadioGroup, NRadioButton, NText, useMessage } from 'naive-ui'
import { getSettings, saveSettings } from '../utils/settings'
import { useIsMobile } from '../composables/useIsMobile'

const { isMobile } = useIsMobile()
const message = useMessage()
const settings = getSettings()

const handleSave = () => {
  saveSettings(settings)
  message.success('设置已保存')
}

const handleReset = () => {
  Object.assign(settings, {
    defaultCollapseRecognition: false,
    defaultCollapseNestedRecognition: true,
    defaultCollapseAction: true,
    displayMode: 'tree'
  })
  saveSettings(settings)
  message.success('已恢复默认设置')
}
</script>

<template>
  <n-card style="height: 100%">
    <n-text strong style="font-size: 16px; display: block; margin-bottom: 16px">显示</n-text>

    <n-form :label-placement="isMobile ? 'top' : 'left'" :label-width="isMobile ? undefined : 200">
      <n-form-item label="节点显示模式">
        <n-radio-group v-model:value="settings.displayMode">
          <n-radio-button value="detailed">详细</n-radio-button>
          <n-radio-button value="compact">紧凑</n-radio-button>
          <n-radio-button value="tree">树形</n-radio-button>
        </n-radio-group>
      </n-form-item>

      <template v-if="settings.displayMode === 'detailed'">
        <n-form-item label="默认折叠根部识别列表">
          <n-switch v-model:value="settings.defaultCollapseRecognition" />
        </n-form-item>

        <n-form-item label="默认折叠嵌套识别节点">
          <n-switch v-model:value="settings.defaultCollapseNestedRecognition" />
        </n-form-item>

        <n-form-item label="默认折叠动作部分">
          <n-switch v-model:value="settings.defaultCollapseAction" />
        </n-form-item>
      </template>
    </n-form>

    <n-flex style="margin-top: 24px; gap: 12px">
      <n-button type="primary" @click="handleSave">保存设置</n-button>
      <n-button @click="handleReset">恢复默认</n-button>
    </n-flex>
  </n-card>
</template>
