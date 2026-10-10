import { test, expect } from '@playwright/test';

const TEST_ACCOUNTS = {
  chromium: {
    email: 'test-chromium@gmail.com',
    password: 'testing123',
  },

  webkit: {
    email: 'test-webkit@gmail.com',
    password: 'testing123',
  },

  'mobile-chrome': {
    email: 'test-mobile-chrome@gmail.com',
    password: 'testing123',
  },

  'mobile-safari': {
    email: 'test-mobile-safari@gmail.com',
    password: 'testing123',
  },
};

test('signed-in user can add a product to cart', async ({
  page,
}, testInfo) => {
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log('NAVIGATION:', frame.url());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  page.on('console', message => {
    console.log(
      `BROWSER CONSOLE [${message.type()}]:`,
      message.text(),
    );
  });

  page.on('request', request => {
    const url = request.url();

    if (
      url.includes('/cart') ||
      url.includes('/wishlist') ||
      url.includes('/auth') ||
      url.includes('/products')
    ) {
      console.log(
        '➡️ REQUEST:',
        request.method(),
        url,
      );
    }
  });

  page.on('response', response => {
    const url = response.url();

    if (
      url.includes('/cart') ||
      url.includes('/wishlist') ||
      url.includes('/auth') ||
      url.includes('/products')
    ) {
      console.log(
        '⬅️ RESPONSE:',
        response.status(),
        url,
      );
    }
  });

  const account = TEST_ACCOUNTS[testInfo.project.name];

  if (!account) {
    throw new Error(
      `No test account configured for project: ${testInfo.project.name}`,
    );
  }

  await page.goto('/');

  await expect(page).toHaveURL(
    'https://e-commerce-3q5.pages.dev/',
  );

  const menuButton = page.getByRole('button', {
    name: 'Open menu',
  });

  if (await menuButton.isVisible()) {
    await menuButton.click();
  }

  await page
    .getByRole('link', {
      name: 'Sign in',
    })
    .click();
  await expect(page).toHaveURL(/\/login/);

  await page
    .getByRole('textbox', {
      name: 'Email',
    })
    .fill(account.email);

  await page
    .getByRole('textbox', {
      name: 'Password Show password',
    })
    .fill(account.password);
  await Promise.all([
    page.waitForResponse(
      response =>
        response.url().includes('/api/auth/login') &&
        response.status() === 200,
    ),

    page
      .getByRole('button', {
        name: 'Sign In',
      })
      .click(),
  ]);

  await expect(page).toHaveURL(
    'https://e-commerce-3q5.pages.dev/',
    {
      timeout: 15000,
    },
  );

  const shopMenuButton = page.getByRole('button', {
    name: 'Open menu',
  });

  if (await shopMenuButton.isVisible()) {
    await shopMenuButton.click();
  }

  const shopLink = page.getByRole('link', {
    name: 'Shop',
    exact: true,
  });

  await expect(shopLink).toBeVisible({
    timeout: 10000,
  });

  await shopLink.click();

  await expect(page).toHaveURL(/\/shop/);

  const nikeProduct = page
    .getByRole('link', {
      name: 'Nike Airforce Nike Nike',
    })
    .first();

  await expect(nikeProduct).toBeVisible({
    timeout: 15000,
  });

  await nikeProduct.click();

  const addToCartButton =
    page.getByRole('button', {
      name: 'Add 1 to Cart',
    });

  await expect(page).toHaveURL(
    /\/products\/19/,
    {
      timeout: 10000,
    },
  );

  await expect(addToCartButton).toBeVisible({
    timeout: 20000,
  });

  await addToCartButton.click();

  const cartMenuButton = page.getByRole('button', {
    name: 'Open menu',
  });

  if (await cartMenuButton.isVisible()) {
    await cartMenuButton.click();

    const cartLink = page
      .getByRole('banner')
      .getByRole('link', {
        name: 'Cart',
      });

    await expect(cartLink).toBeVisible({
      timeout: 10000,
    });

    await cartLink.click();
  } else {
    await page
      .getByLabel('Cart')
      .click();
  }

  await expect(page).toHaveURL(
    /\/cart/,
    {
      timeout: 15000,
    },
  );

  const cartItem = page.locator('article').filter({
  has: page.getByRole('link', {
    name: 'Nike Airforce',
    exact: true,
  }),
});

await expect(cartItem).toHaveCount(1, {
  timeout: 15000,
});

await expect(
  cartItem.getByRole('link', {
  name: 'Nike Airforce',
  exact: true,
})
.first(),
).toHaveAttribute(
  'href',
  '/products/19',
);
});