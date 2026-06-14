import { mount } from '@vue/test-utils'
import { describe, expect, test } from 'vitest'
import {
  ElDangerZone,
  ElDestructiveActionPanel,
  ElFormSection,
  ElInlineActions,
  ElMetadataItem,
  ElMetadataRow,
  ElResourceList,
  ElResourceListItem,
  ElRiskNotice,
  ElSectionHeader,
  ElSectionNav,
  ElSettingsSection,
  ElTypedConfirmField,
} from '..'

describe('settings primitives', () => {
  test('renders generic section nav with accessible current and disabled states', async () => {
    const wrapper = mount(() => (
      <ElSectionNav
        items={[
          { label: 'Overview', href: '#overview', current: true },
          { label: 'Resources', href: '#resources' },
          { label: 'Locked', href: '#locked', disabled: true },
        ]}
      />
    ))

    expect(wrapper.find('.el-section-nav').attributes('aria-label')).toBe(
      'Section navigation',
    )
    expect(wrapper.find('[aria-current="location"]').text()).toBe('Overview')
    expect(wrapper.find('[aria-disabled="true"]').attributes('href')).toBe(
      undefined,
    )
  })

  test('renders settings, form, and standalone section headers with slot-first actions', () => {
    const wrapper = mount(() => (
      <div>
        <ElSettingsSection title="Display" description="Generic section">
          {{
            actions: () => <button type="button">Save</button>,
            default: () => <p>Body</p>,
          }}
        </ElSettingsSection>
        <ElFormSection title="Form" density="compact">
          <label>
            Field
            <input />
          </label>
        </ElFormSection>
        <ElSectionHeader title="Standalone header" titleTag="h3">
          {{
            actions: () => <button type="button">Action</button>,
          }}
        </ElSectionHeader>
      </div>
    ))

    expect(wrapper.find('.el-settings-section__title').text()).toBe('Display')
    expect(wrapper.find('.el-settings-section__actions button').text()).toBe(
      'Save',
    )
    expect(wrapper.find('.el-form-section--compact').exists()).toBe(true)
    expect(wrapper.find('.el-section-header__title').element.tagName).toBe('H3')
  })

  test('renders resource list, metadata row, and inline actions without domain semantics', () => {
    const wrapper = mount(() => (
      <ElResourceList>
        <ElResourceListItem
          title="Resource"
          description="Last changed recently"
        >
          {{
            badge: () => <span>Active</span>,
            actions: () => (
              <ElInlineActions aria-label="Row actions">
                <button type="button">Edit</button>
              </ElInlineActions>
            ),
            default: () => (
              <ElMetadataRow>
                <ElMetadataItem label="Created" value="2026-01-01" />
                <ElMetadataItem label="Fingerprint" monospace />
              </ElMetadataRow>
            ),
          }}
        </ElResourceListItem>
      </ElResourceList>
    ))

    expect(wrapper.find('.el-resource-list').attributes('role')).toBe('list')
    expect(wrapper.find('.el-resource-list-item').attributes('role')).toBe(
      'listitem',
    )
    expect(wrapper.find('.el-metadata-item.is-monospace').text()).toContain('-')
    expect(wrapper.find('.el-inline-actions').attributes('aria-label')).toBe(
      'Row actions',
    )
  })

  test('renders danger primitives with copy supplied by the caller', () => {
    const wrapper = mount(() => (
      <ElDangerZone title="Risk area">
        <ElRiskNotice title="Review" role="note">
          Check the consequences before continuing.
        </ElRiskNotice>
        <ElDestructiveActionPanel title="Remove resource">
          {{
            description: () => 'This cannot be undone.',
            actions: () => <button type="button">Remove</button>,
          }}
        </ElDestructiveActionPanel>
      </ElDangerZone>
    ))

    expect(wrapper.find('.el-danger-zone__title').text()).toBe('Risk area')
    expect(wrapper.find('.el-risk-notice').attributes('role')).toBe('note')
    expect(wrapper.find('.el-destructive-action-panel__actions').text()).toBe(
      'Remove',
    )
  })

  test('typed confirm field exposes phrase and validates exact input accessibly', async () => {
    const wrapper = mount({
      data: () => ({ value: '' }),
      render() {
        return (
          <ElTypedConfirmField
            modelValue={this.value}
            onUpdate:modelValue={(value: string) => {
              this.value = value
            }}
            phrase="CONFIRM"
            label="Confirmation phrase"
            description="Type the exact phrase."
          />
        )
      },
    })

    const input = wrapper.find('input')
    expect(input.attributes('aria-describedby')).toContain('phrase')
    await input.setValue('CONF')
    expect(wrapper.find('.el-typed-confirm-field').classes()).toContain(
      'is-invalid',
    )
    expect(input.attributes('aria-invalid')).toBe('true')
    await input.setValue('CONFIRM')
    expect(wrapper.find('.el-typed-confirm-field').classes()).toContain(
      'is-complete',
    )
    expect(input.attributes('aria-invalid')).toBe(undefined)
  })
})
