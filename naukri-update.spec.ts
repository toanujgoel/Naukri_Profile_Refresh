import { test, expect, Page } from '@playwright/test';

test.describe('Naukri Resume Headline Refresh', () => {
    test('should login and update resume headline', async ({ page }) => {
        // --- Configuration ---
        const username = process.env.NAUKRI_USERNAME;
        const password = process.env.NAUKRI_PASSWORD;

        if (!username || !password) {
            throw new Error('Environment variables NAUKRI_USERNAME and NAUKRI_PASSWORD must be set.');
        }

        try {
            console.log('Starting Naukri Resume Refresh Automation...');

            // --- 1. Login Process ---
            console.log('Navigating to login page...');
            await page.goto('https://login.naukri.com/', { waitUntil: 'networkidle' });

            console.log('Entering credentials...');
            // Using robust selectors based on placeholder text which is user-facing
            await page.fill('input[placeholder*="Username"]', username);
            await page.fill('input[placeholder*="Password"]', password);

            console.log('Clicking Login...');
            await page.click('button[type="submit"]');

            // Wait for navigation to homepage or dashboard
            // Using URL assertion to ensure login was successful
            await expect(page).toHaveURL(/naukri\.com\/mnjuser\/homepage/, { timeout: 30000 });
            console.log('Login successful.');

            // --- 2. Navigate to Profile ---
            console.log('Navigating to profile page...');
            // Direct navigation is often more reliable than finding menu items
            await page.goto('https://www.naukri.com/mnjuser/profile', { waitUntil: 'domcontentloaded' });

            // Verify we are on the profile page
            await expect(page).toHaveURL(/naukri\.com\/mnjuser\/profile/);
            console.log('Profile page loaded.');

            // --- 3. Edit and Save Resume Headline ---
            console.log('Locating Resume Headline section...');

            // Strategy: Find the section by text, then find the edit icon within/near it.
            // The structure usually has a widget with "Resume Headline" title.
            // We look for the "edit" text or icon associated with it.
            // A common pattern in Naukri is a specific class or structure, but we'll try to be generic where possible
            // or use the specific known structure if generic fails. 
            // Based on typical Naukri structure:
            // There is a 'Resume Headline' text, and next to it (or in the same container) is an edit link/icon.

            // Using a locator that finds the container with text "Resume Headline" and then the edit link inside it.
            // Note: Selectors might need adjustment if Naukri UI changes.
            const resumeHeadlineSection = page.locator('.resumeHeadline'); // Common class, but let's be more robust if possible
            // Alternative: Text based
            const editIcon = page.locator('xpath=//span[text()="Resume Headline"]/following-sibling::span[contains(@class, "edit")]').first();

            // Fallback/More robust selector if the above is too specific to structure:
            // Look for the text "Resume Headline" and click the "edit" text/icon nearby.
            // In many Naukri versions, it's a pencil icon with class 'edit'.

            // Let's try a selector that targets the specific edit action for headline
            // Often: <div class="resumeHeadline"> ... <span class="edit">One Line Resume Headline</span> ... </div>
            // Or: <span class="widgetTitle">Resume Headline</span> ... <span class="edit icon"></span>

            // We will wait for the edit icon to be visible to ensure the section is loaded
            const editButton = page.locator('.resumeHeadline .edit, .widgetTitle:has-text("Resume Headline") ~ .edit').first();

            console.log('Clicking edit icon...');
            await editButton.click();

            // --- 4. Handle Modal/Form ---
            console.log('Waiting for edit dialog...');
            // Wait for the modal or form to appear. 
            // Usually a lightbox or a form that expands.
            // We look for the "Save" button which indicates the form is ready.
            const saveButton = page.getByRole('button', { name: 'Save' });
            await expect(saveButton).toBeVisible();

            console.log('Clicking Save...');
            // We don't change the text, just click save to "refresh" it.
            await saveButton.click();

            // --- 5. Verification ---
            console.log('Verifying success message...');
            const successMessageContainer = page.locator('.msgBox.success');

            // Wait for the container to appear
            await expect(successMessageContainer).toBeVisible({ timeout: 10000 });

            // Assert the text content within the container
            // This handles the separate lines for "Success" and the message body
            await expect(successMessageContainer).toContainText('Success');
            await expect(successMessageContainer).toContainText('Resume Headline has been successfully saved.');

            console.log('Resume headline refreshed successfully!');

        } catch (error) {
            console.error('An error occurred during the automation script:', error);
            // Take a screenshot on failure for debugging
            await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
            throw error; // Re-throw to fail the test
        }
    });
});
