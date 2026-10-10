import { test, expect } from '@playwright/test';

test('TerraLens homepage loads correctly', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/TerraLens/i);

  await expect(page.locator('body')).toBeVisible();
});