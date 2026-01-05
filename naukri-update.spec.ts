import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Supported resume file extensions (as per Naukri)
const SUPPORTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.rtf'];

/**
 * Automatically detect a resume file in the assets folder
 * @returns The path to the first matching resume file, or null if none found
 */
function findResumeFile(): string | null {
    const assetsDir = path.join(__dirname, 'assets');

    if (!fs.existsSync(assetsDir)) {
        console.error('Assets folder not found:', assetsDir);
        return null;
    }

    const files = fs.readdirSync(assetsDir);

    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
            return path.join(assetsDir, file);
        }
    }

    return null;
}

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

            // --- 6. Update Resume ---
            console.log('Starting Resume Update...');

            // Scroll to the resume section to ensure it's visible
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.waitForTimeout(1000);

            // Find the "Update resume" button
            // Based on DOM: <input type="button" value="Update resume" class="dummyUpload typ-14Bold">
            const updateResumeButton = page.locator('input[type="button"][value="Update resume"], input.dummyUpload[value="Update resume"]').first();

            // Wait for the button to be visible
            await expect(updateResumeButton).toBeVisible({ timeout: 10000 });
            console.log('Found "Update resume" button.');

            // Set up file chooser handler before clicking the button
            // The button click triggers a hidden file input
            const fileChooserPromise = page.waitForEvent('filechooser');

            console.log('Clicking "Update resume" button...');
            await updateResumeButton.click();

            // Handle the file chooser dialog
            const fileChooser = await fileChooserPromise;

            // Auto-detect resume file in assets folder
            // Supports: doc, docx, rtf, pdf (up to 2 MB as per Naukri)
            const resumePath = findResumeFile();

            if (!resumePath) {
                throw new Error('No resume file found in assets folder. Please add a .pdf, .doc, .docx, or .rtf file.');
            }

            console.log(`Auto-detected resume file: ${path.basename(resumePath)}`);
            console.log(`Uploading resume from: ${resumePath}`);
            await fileChooser.setFiles(resumePath);

            // Wait for upload to complete - look for success message
            console.log('Waiting for upload confirmation...');

            // Verify the success message appears after upload
            // Message: "Success - Resume has been successfully uploaded."
            // Use filter to specifically target the resume upload message (not the headline one)
            const uploadSuccessMessage = page.locator('.msgBox.success').filter({
                hasText: 'Resume has been successfully uploaded.'
            });
            await expect(uploadSuccessMessage).toBeVisible({ timeout: 15000 });
            console.log('✓ Resume uploaded successfully! Success message verified.');

            console.log('Naukri Resume Refresh & Update Automation completed successfully!');

        } catch (error) {
            console.error('An error occurred during the automation script:', error);
            // Take a screenshot on failure for debugging
            await page.screenshot({ path: 'error-screenshot.png', fullPage: true });
            throw error; // Re-throw to fail the test
        }
    });
});
