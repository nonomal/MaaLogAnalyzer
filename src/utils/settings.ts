/**
 * 应用设置管理
 */

export interface AppSettings {
  // 默认折叠识别尝试的嵌套节点
  defaultCollapseRecognition: boolean
  // 默认折叠动作部分
  defaultCollapseAction: boolean
}

const SETTINGS_KEY = 'maa-log-analyzer-settings'

const defaultSettings: AppSettings = {
  defaultCollapseRecognition: false,
  defaultCollapseAction: false
}

/**
 * 获取设置
 */
export function getSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.error('读取设置失败:', error)
  }
  return defaultSettings
}

/**
 * 保存设置
 */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}
