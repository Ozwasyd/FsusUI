<template>
  <div id="settings-visual" class="demo-section" data-testid="settings-visual-fixtures">
    <h2>Settings Composition Acceptance</h2>

    <!-- Full settings page -->
    <div class="demo-block" data-settings-fixture="full-page">
      <h3>Settings Page</h3>
      <div class="settings-fixture-row" data-settings-variant="default">
        <ElSectionNav ariaLabel="Settings">
          <ElSectionNavLink to="#general">General</ElSectionNavLink>
          <ElSectionNavLink to="#security" active>Security</ElSectionNavLink>
          <ElSectionNavLink to="#notifications">Notifications</ElSectionNavLink>
          <ElSectionNavLink to="#danger" disabled>Danger Zone</ElSectionNavLink>
        </ElSectionNav>
      </div>
    </div>

    <!-- FormSection -->
    <div class="demo-block" data-settings-fixture="form-section">
      <h3>FormSection</h3>
      <div class="settings-fixture-row" data-settings-variant="form-default">
        <ElSectionHeader title="Account Settings" description="Manage your account preferences" />
        <ElFormSection>
          <p style="margin: 0; padding: 8px;">Form content area — flat, no card surface</p>
        </ElFormSection>
      </div>
    </div>

    <!-- ResourceList -->
    <div class="demo-block" data-settings-fixture="resource-list">
      <h3>ResourceList</h3>
      <div class="settings-fixture-row" data-settings-variant="resource-default">
        <ElResourceList>
          <ElResourceListItem title="API Key" description="sk-...abc123" />
          <ElResourceListItem title="Webhook URL" description="https://hooks.example.com/callback" />
        </ElResourceList>
      </div>
    </div>

    <!-- DangerZone -->
    <div class="demo-block" data-settings-fixture="danger-zone">
      <h3>DangerZone</h3>
      <div class="settings-fixture-row" data-settings-variant="danger-default">
        <ElDangerZone>
          <ElRiskNotice title="Caution" role="note">
            This action is irreversible. Please confirm below.
          </ElRiskNotice>
          <ElDestructiveActionPanel title="Delete Account">
            <template #description>
              Permanently delete your account and all associated data.
            </template>
          </ElDestructiveActionPanel>
          <ElTypedConfirmField phrase="DELETE" />
        </ElDangerZone>
      </div>
    </div>

    <!-- TypedConfirmField -->
    <div class="demo-block" data-settings-fixture="typed-confirm">
      <h3>TypedConfirmField</h3>
      <div class="settings-fixture-row" data-settings-variant="typed-default">
        <ElTypedConfirmField phrase="DELETE" />
      </div>
      <div class="settings-fixture-row" data-settings-variant="typed-invalid">
        <ElTypedConfirmField phrase="DELETE" model-value="wrong-phrase" />
      </div>
    </div>

    <div data-testid="settings-gate-css" style="display:none" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import {
  ElDangerZone,
  ElDestructiveActionPanel,
  ElFormSection,
  ElResourceList,
  ElResourceListItem,
  ElRiskNotice,
  ElSectionHeader,
  ElSectionNav,
  ElSectionNavLink,
  ElTypedConfirmField,
} from '@element-plus/components'
</script>
