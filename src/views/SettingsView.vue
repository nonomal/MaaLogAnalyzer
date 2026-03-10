<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NCard, NForm, NFormItem, NSwitch, NButton, NFlex, useMessage } from 'naive-ui'
import { getSettings, saveSettings, type AppSettings } from '../utils/settings'

const message = useMessage()
const settings = ref<AppSettings>(getSettings())

onMounted(() => {
  settings.value = getSettings()
})

const handleSave = () => {
  saveSettings(settings.value)
  message.success('设置已保存')
}

const handleReset = () => {
  settings.value = {
    defaultCollapseRecognition: true,
    defaultCollapseAction: true
  }
  saveSettings(settings.value)
  message.success('已恢复默认设置')
}
</script>

<template>
  <n-card style="height: 100%">
    <n-text strong style="font-size: 16px; display: block; margin-bottom: 16px">显示</n-text>

    <n-form label-placement="left" label-width="200">
      <n-form-item label="默认折叠识别尝试">
        <n-switch v-model:value="settings.defaultCollapseRecognition" />
      </n-form-item>

      <n-form-item label="默认折叠动作部分">
        <n-switch v-model:value="settings.defaultCollapseAction" />
      </n-form-item>
    </n-form>

    <n-flex style="margin-top: 24px; gap: 12px">
      <n-button type="primary" @click="handleSave">保存设置</n-button>
      <n-button @click="handleReset">恢复默认</n-button>
    </n-flex>
  </n-card>
</template>
