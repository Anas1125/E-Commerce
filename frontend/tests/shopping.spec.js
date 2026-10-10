import { test, expect } from '@playwright/test';

test('user can browse the shop and open a product', async ({ page }) => {
  await page.goto('/');

  // Mobile navigation uses a menu button.
  const menuButton = page.getByRole('button', { name: 'Open menu' });

  if (await menuButton.isVisible()) {
    await menuButton.click();
  }

  // Open Shop
  await page.getByRole('link', { name: 'Shop', exact: true }).click();

  // Verify Shop page loaded
  await expect(page).toHaveURL(/shop/i);

  // Open a product
  await page.getByRole('link', { name: 'Nike Airforce Nike Nike' }).click();

  // Verify the product is visible
  await expect(
    page.getByText('Nike Airforce', { exact: false }).first()
  ).toBeVisible();
});