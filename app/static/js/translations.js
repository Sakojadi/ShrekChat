// Translation functionality for ShrekChat
// Uses DeepL API for translating messages

// Available languages for translation
const availableLanguages = [
    { code: 'EN', name: 'English' },
    { code: 'DE', name: 'German' },
    { code: 'FR', name: 'French' },
    { code: 'ES', name: 'Spanish' },
    { code: 'IT', name: 'Italian' },
    { code: 'NL', name: 'Dutch' },
    { code: 'PL', name: 'Polish' },
    { code: 'PT', name: 'Portuguese' },
    { code: 'RU', name: 'Russian' },
    { code: 'JA', name: 'Japanese' },
    { code: 'ZH', name: 'Chinese' },
];

// Cache for translations to reduce API calls
const translationCache = {};

// Store translations in local browser storage to make them user-specific
// This way, translations won't be visible to other users
const TRANSLATIONS_STORAGE_KEY = 'shrekchat_translations';

// Function to save a translation to local storage
function saveTranslation(messageId, translatedText, originalText, targetLang) {
    let storedTranslations = localStorage.getItem(TRANSLATIONS_STORAGE_KEY);
    let translations = storedTranslations ? JSON.parse(storedTranslations) : {};
    
    // Add new translation
    translations[messageId] = {
        translatedText,
        originalText,
        targetLang,
        timestamp: Date.now()
    };
    
    // Limit the number of translations to prevent excessive storage usage
    // Keep most recent 100 translations
    const MAX_STORED_TRANSLATIONS = 100;
    const translationEntries = Object.entries(translations);
    
    if (translationEntries.length > MAX_STORED_TRANSLATIONS) {
        // Sort by timestamp (oldest first)
        translationEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Create new object with only the most recent translations
        translations = Object.fromEntries(
            translationEntries.slice(translationEntries.length - MAX_STORED_TRANSLATIONS)
        );
    }
    
    // Store in local storage
    localStorage.setItem(TRANSLATIONS_STORAGE_KEY, JSON.stringify(translations));
}

// Function to get a translation from local storage
function getStoredTranslation(messageId) {
    let storedTranslations = localStorage.getItem(TRANSLATIONS_STORAGE_KEY);
    if (!storedTranslations) return null;
    
    let translations = JSON.parse(storedTranslations);
    return translations[messageId] || null;
}

// Function to generate cache key
function getCacheKey(text, targetLang) {
    return `${text}|${targetLang}`;
}

// Function to translate a message
async function translateMessage(messageId, text, targetLang) {
    try {
        // Check cache first
        const cacheKey = getCacheKey(text, targetLang);
        if (translationCache[cacheKey]) {
            console.log('Using cached translation');
            
            // If this is for a specific message, save it to local storage
            if (messageId) {
                saveTranslation(messageId, translationCache[cacheKey], text, targetLang);
            }
            
            return translationCache[cacheKey];
        }

        // Call the translation API endpoint
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message_id: messageId,
                text: text,
                target_lang: targetLang,
                update_message: false // Always false to ensure translations are client-side only
            })
        });

        if (!response.ok) {
            throw new Error('Translation request failed');
        }

        const data = await response.json();
        
        // Cache the result
        translationCache[cacheKey] = data.translated_text;
        
        // If this is for a specific message, save it to local storage
        if (messageId) {
            saveTranslation(messageId, data.translated_text, text, targetLang);
        }
        
        return data.translated_text;
    } catch (error) {
        console.error('Translation error:', error);
        return null;
    }
}

// Function to show translation languages dropdown
function showTranslationOptions(messageElement) {
    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.translation-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'translation-dropdown';
    
    // Add header
    const header = document.createElement('div');
    header.className = 'translation-dropdown-header';
    header.textContent = 'Translate to:';
    dropdown.appendChild(header);
    
    // Add language options
    availableLanguages.forEach(lang => {
        const option = document.createElement('div');
        option.className = 'translation-option';
        option.textContent = lang.name;
        option.dataset.langCode = lang.code;
        
        option.addEventListener('click', async () => {
            const messageId = messageElement.dataset.messageId;
            const messageContent = messageElement.querySelector('.message-content');
            const originalText = messageElement.dataset.originalText || messageContent.textContent;
            
            // Store original text if not already stored
            if (!messageElement.dataset.originalText) {
                messageElement.dataset.originalText = originalText;
            }
            
            // Show loading indicator
            messageContent.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
            
            // Get translation
            const translatedText = await translateMessage(messageId, originalText, lang.code);
            
            if (translatedText) {
                // Update message content
                messageContent.textContent = translatedText;
                messageElement.classList.add('translated');
                messageElement.dataset.translatedText = translatedText;
                
                // Add "Show Original" button if not already present
                if (!messageElement.querySelector('.show-original-btn')) {
                    const showOriginalBtn = document.createElement('button');
                    showOriginalBtn.className = 'show-original-btn';
                    showOriginalBtn.innerHTML = '<i class="fas fa-language"></i> Original';
                    showOriginalBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleOriginalText(messageElement);
                    });
                    messageElement.appendChild(showOriginalBtn);
                }
            } else {
                // Restore original text if translation failed
                messageContent.textContent = originalText;
                Swal.fire({
                    title: 'Translation Failed',
                    text: 'Could not translate the message. Please try again later.',
                    icon: 'error',
                    confirmButtonText: 'OK'
                });
            }
            
            // Remove dropdown
            dropdown.remove();
        });
        
        dropdown.appendChild(option);
    });
    
    // Position dropdown near the message
    document.body.appendChild(dropdown);
    
    // Get position relative to message
    const rect = messageElement.getBoundingClientRect();
    const isOutgoing = messageElement.classList.contains('outgoing');
    
    if (isOutgoing) {
        dropdown.style.left = `${rect.left - dropdown.offsetWidth - 10}px`;
    } else {
        dropdown.style.left = `${rect.right + 10}px`;
    }
    dropdown.style.top = `${rect.top}px`;
    
    // Close dropdown when clicking elsewhere
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && !e.target.classList.contains('translate-btn')) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    };
    
    // Add delay to prevent immediate closing
    setTimeout(() => {
        document.addEventListener('click', closeDropdown);
    }, 100);
}

// Function to show translation input dropdown for the message input
function showInputTranslationOptions() {
    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.translation-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }
    
    const translateBtn = document.getElementById('translateInputBtn');
    if (!translateBtn) return;
    
    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'translation-dropdown';
    
    // Add header
    const header = document.createElement('div');
    header.className = 'translation-dropdown-header';
    header.textContent = 'Translate input to:';
    dropdown.appendChild(header);
    
    // Add language options
    availableLanguages.forEach(lang => {
        const option = document.createElement('div');
        option.className = 'translation-option';
        option.textContent = lang.name;
        option.dataset.langCode = lang.code;
        
        option.addEventListener('click', async () => {
            const messageInput = document.getElementById('messageInput');
            if (!messageInput || !messageInput.value.trim()) {
                dropdown.remove();
                return;
            }
            
            const originalText = messageInput.value;
            
            // Show loading indicator in input field
            const originalPlaceholder = messageInput.placeholder;
            messageInput.value = 'Translating...';
            messageInput.disabled = true;
            
            // Get translation
            const translatedText = await translateMessage(null, originalText, lang.code);
            
            if (translatedText) {
                // Update input with translated text
                messageInput.value = translatedText;
                
                // Keep track that this is a pre-translated message
                messageInput.dataset.originalText = originalText;
                messageInput.dataset.isTranslated = 'true';
                messageInput.dataset.translatedTo = lang.code;
                
                // Focus back on the input
                messageInput.disabled = false;
                messageInput.focus();
                
                // Show indication that text is translated
                translateBtn.classList.add('active');
            } else {
                // Restore original text if translation failed
                messageInput.value = originalText;
                messageInput.disabled = false;
                
                Swal.fire({
                    title: 'Translation Failed',
                    text: 'Could not translate the message. Please try again later.',
                    icon: 'error', 
                    confirmButtonText: 'OK'
                });
            }
            
            // Remove dropdown
            dropdown.remove();
        });
        
        dropdown.appendChild(option);
    });
    
    // Add option to clear translation
    if (document.getElementById('messageInput')?.dataset.isTranslated === 'true') {
        const clearOption = document.createElement('div');
        clearOption.className = 'translation-option clear-translation';
        clearOption.textContent = 'Show Original';
        
        clearOption.addEventListener('click', () => {
            const messageInput = document.getElementById('messageInput');
            if (messageInput?.dataset.originalText) {
                messageInput.value = messageInput.dataset.originalText;
                messageInput.dataset.isTranslated = 'false';
                translateBtn.classList.remove('active');
            }
            dropdown.remove();
        });
        
        dropdown.appendChild(clearOption);
    }
    
    // Position dropdown near the button
    document.body.appendChild(dropdown);
    
    // Position dropdown ABOVE the button instead of below
    const rect = translateBtn.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    
    // Check if there's enough space above the button
    const dropdownHeight = dropdown.offsetHeight;
    if (rect.top < dropdownHeight + 10) {
        // Not enough space above, position below instead
        dropdown.style.top = `${rect.bottom + 5}px`;
    } else {
        // Position above the button
        dropdown.style.top = `${rect.top - dropdownHeight - 5}px`;
    }
    
    // Close dropdown when clicking elsewhere
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== translateBtn) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    };
    
    // Add delay to prevent immediate closing
    setTimeout(() => {
        document.addEventListener('click', closeDropdown);
    }, 100);
}

// Function to toggle between original and translated text
function toggleOriginalText(messageElement) {
    const messageContent = messageElement.querySelector('.message-content');
    const originalText = messageElement.dataset.originalText;
    const translatedText = messageElement.dataset.translatedText;
    const showOriginalBtn = messageElement.querySelector('.show-original-btn');
    
    // If currently showing translation, switch to original
    if (messageElement.classList.contains('translated')) {
        // Only switch if we have the original text
        if (originalText) {
            messageContent.textContent = originalText;
            messageElement.classList.remove('translated');
            if (showOriginalBtn) {
                showOriginalBtn.innerHTML = '<i class="fas fa-language"></i> Translated';
            }
        }
    } 
    // If currently showing original, switch back to translation
    else {
        // Make sure we have the translated text
        if (translatedText) {
            messageContent.textContent = translatedText;
            messageElement.classList.add('translated');
            if (showOriginalBtn) {
                showOriginalBtn.innerHTML = '<i class="fas fa-language"></i> Original';
            }
        }
    }
}

// Attach translation button to messages
function attachTranslationButtons() {
    const messages = document.querySelectorAll('.message');
    
    messages.forEach(message => {
        // Skip if button already exists
        if (message.querySelector('.translate-btn')) {
            return;
        }
        
        // Get message ID
        const messageId = message.getAttribute('data-message-id');
        if (!messageId) return;
        
        // Check if there's a stored translation for this message
        const storedTranslation = getStoredTranslation(messageId);
        if (storedTranslation) {
            // Apply stored translation only if this is not the sender's message
            // This ensures translations don't affect the original sender's view
            const isOutgoing = message.classList.contains('outgoing');
            const messageContent = message.querySelector('.message-content');
            
            if (messageContent && !isOutgoing) {
                message.dataset.originalText = storedTranslation.originalText;
                message.dataset.translatedText = storedTranslation.translatedText;
                message.classList.add('translated');
                messageContent.textContent = storedTranslation.translatedText;
                
                // Add "Show Original" button if not already present
                if (!message.querySelector('.show-original-btn')) {
                    const showOriginalBtn = document.createElement('button');
                    showOriginalBtn.className = 'show-original-btn';
                    showOriginalBtn.innerHTML = '<i class="fas fa-language"></i> Original';
                    showOriginalBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleOriginalText(message);
                    });
                    message.appendChild(showOriginalBtn);
                }
            }
        }
        
        // Create translation button
        const translateBtn = document.createElement('button');
        translateBtn.className = 'translate-btn';
        translateBtn.innerHTML = '<i class="fas fa-language"></i>';
        translateBtn.title = 'Translate message';
        
        // Add click handler
        translateBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showTranslationOptions(message);
        });
        
        // Position button differently based on message direction
        if (message.classList.contains('outgoing')) {
            translateBtn.classList.add('translate-btn-outgoing');
        } else {
            translateBtn.classList.add('translate-btn-incoming');
        }
        
        // Append button to message
        message.appendChild(translateBtn);
    });
}

// Add CSS for translation elements
function addTranslationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .message {
            position: relative;
        }
        
        .translate-btn {
            position: absolute;
            top: 50%;
            background: none;
            border: none;
            color: #7BAE37;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            font-size: 16px;
        }
        
        .translate-btn-incoming {
            transform: translateY(-50%);
            right: -30px;
        }
        
        .translate-btn-outgoing {
            transform: translateY(-50%);
            left: -30px;
        }
        
        .message:hover .translate-btn {
            opacity: 1;
        }
        
        .translation-dropdown {
            position: fixed;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            width: 150px;
            max-height: 300px;
            overflow-y: auto;
        }
        
        .translation-dropdown-header {
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
            font-weight: bold;
            color: #555;
        }
        
        .translation-option {
            padding: 8px 12px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .translation-option:hover {
            background-color: #f5f5f5;
        }
        
        .translation-option.clear-translation {
            border-top: 1px solid #eee;
            color: #7BAE37;
            font-weight: bold;
        }
        
        .show-original-btn {
            position: absolute;
            bottom: -20px;
            right: 10px;
            background: #f0f0f0;
            border: none;
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 11px;
            color: #555;
            cursor: pointer;
            opacity: 0.8;
        }
        
        .show-original-btn:hover {
            opacity: 1;
        }
        
        .message.translated .message-content {
            font-style: italic;
        }
        
        .translate-input-btn {
            background: none;
            border: none;
            color: #7BAE37;
            cursor: pointer;
            font-size: 18px;
            padding: 0 10px;
            transition: color 0.2s;
        }
        
        .translate-input-btn.active {
            color: #5a8728;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(1.05);
            }
            100% {
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
}

// Modify the sendMessage function to handle translated input
function attachSendMessageHandler() {
    const originalSendMessage = window.sendMessage;
    if (originalSendMessage && !window.translationHandlerAttached) {
        window.sendMessage = function() {
            const messageInput = document.getElementById('messageInput');
            
            // If the message was pre-translated, clear the translation indicators
            if (messageInput?.dataset.isTranslated === 'true') {
                const translateBtn = document.getElementById('translateInputBtn');
                if (translateBtn) {
                    translateBtn.classList.remove('active');
                }
                
                // Clear the translation data attributes after sending
                setTimeout(() => {
                    messageInput.dataset.isTranslated = 'false';
                    messageInput.dataset.originalText = '';
                    messageInput.dataset.translatedTo = '';
                }, 100);
            }
            
            // Call the original sendMessage function
            return originalSendMessage.apply(this, arguments);
        };
        window.translationHandlerAttached = true;
    }
}

// Initialize translation functionality
function initializeTranslation() {
    // Add translation styles
    addTranslationStyles();
    
    // Attach translation buttons to existing messages
    attachTranslationButtons();
    
    // Set up observer to attach buttons to new messages
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    attachTranslationButtons();
                }
            });
        });
        
        observer.observe(chatMessages, { childList: true, subtree: true });
    }
    
    // Add click handler for input translation button
    const translateInputBtn = document.getElementById('translateInputBtn');
    if (translateInputBtn) {
        translateInputBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showInputTranslationOptions();
        });
    }
    
    // Modify sendMessage to handle translated input
    attachSendMessageHandler();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTranslation);
