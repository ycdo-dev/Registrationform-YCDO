// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDyJdKzSPpUeAgs1ni5dJD7DviblX2E2B4",
    authDomain: "ycdo---registration-form.firebaseapp.com",
    projectId: "ycdo---registration-form",
    storageBucket: "ycdo---registration-form.firebasestorage.app",
    messagingSenderId: "632743367139",
    appId: "1:632743367139:web:d4f4cdc81329e0925cd0d6",
    measurementId: "G-1NWJ10FCQG"
};

// Initialize Firebase
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
    });
    
    // Enable offline persistence
    db.enablePersistence()
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code == 'unimplemented') {
                console.warn('The current browser does not support offline persistence');
            }
        });
    
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
    showError('មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ប្រព័ន្ធ។ សូមព្យាយាមម្តងទៀត។');
}

// DOM Elements
const form = document.getElementById('registrationForm');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const modal = document.getElementById('qrModal');
const closeButton = document.querySelector('.close-button');
const downloadButton = document.getElementById('downloadQR');

// Hide messages initially
successMessage.style.display = 'none';
errorMessage.style.display = 'none';

// Form validation
function validateForm(formData) {
    if (!formData.name || formData.name.trim() === '') {
        throw new Error('សូមបញ្ចូលឈ្មោះ');
    }
    if (!formData.gender) {
        throw new Error('សូមជ្រើសរើសភេទ');
    }
    if (!formData.phone || !/^[0-9+\-\s]*$/.test(formData.phone)) {
        throw new Error('សូមបញ្ចូលលេខទូរស័ព្ទត្រឹមត្រូវ');
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        throw new Error('សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ');
    }
    if (!formData.address || formData.address.trim() === '') {
        throw new Error('សូមបញ្ចូលអាសយដ្ឋាន');
    }
}

// Generate registration ID
function generateRegistrationId() {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `REG${timestamp}${random}`;
}

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.classList.add('loading');
    
    try {
        // Get form data
        const formData = {
            name: form.name.value,
            gender: form.gender.value,
            phone: form.phone.value,
            email: form.email.value || '',
            address: form.address.value,
            registrationId: generateRegistrationId(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'បានចុះឈ្មោះ'
        };

        // Validate form data
        validateForm(formData);

        // Save to Firestore
        const docRef = await saveToFirebase(formData);

        // Create QR code data with Khmer support
        const qrData = {
            documentId: docRef.id,
            registrationId: formData.registrationId,
            name: formData.name,
            phone: formData.phone
        };

        // Convert to base64 with proper Khmer encoding
        const qrDataString = btoa(unescape(encodeURIComponent(JSON.stringify(qrData))));
        
        // Generate QR code
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = ''; // Clear previous QR code

        new QRCode(qrContainer, {
            text: qrDataString,
            width: 256,
            height: 256,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H,
            quietZone: 15,
            quietZoneColor: '#FFFFFF'
        });

        // Show success message and modal
        showSuccess();
        showModal();
        form.reset();

        // Setup download button
        setupDownloadButton(qrContainer, formData);

    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        submitButton.classList.remove('loading');
    }
});

// Save to Firebase
async function saveToFirebase(formData) {
    try {
        const docRef = await db.collection('registrations').add({
            ...formData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        return docRef;
    } catch (error) {
        handleFirebaseError(error);
        throw error;
    }
}

// Handle Firebase errors
function handleFirebaseError(error) {
    console.error('Firebase Error:', error);
    
    let errorMessage = 'មានបញ្ហាកើតឡើង។ សូមព្យាយាមម្តងទៀត។';
    
    switch(error.code) {
        case 'permission-denied':
            errorMessage = 'អ្នកមិនមានសិទ្ធិគ្រប់គ្រាន់ក្នុងការធ្វើប្រតិបត្តិការនេះទេ។';
            break;
        case 'unavailable':
            errorMessage = 'មិនអាចភ្ជាប់ទៅកាន់ប្រព័ន្ធបានទេ។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិតរបស់អ្នក។';
            break;
        case 'not-found':
            errorMessage = 'រកមិនឃើញទិន្នន័យដែលអ្នកស្វែងរកទេ។';
            break;
    }
    
    showError(errorMessage);
}

// Setup download functionality for QR Code
function setupDownloadButton(qrContainer, formData) {
    const downloadButton = document.getElementById('downloadQR');
    if (downloadButton) {
        downloadButton.onclick = () => {
            const qrImage = qrContainer.querySelector('img');
            if (qrImage) {
                // Create a canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const padding = 50;

                // Set canvas size
                canvas.width = qrImage.width + (padding * 2);
                canvas.height = qrImage.height + (padding * 2) + 60; // Extra height for text

                // Fill background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Draw QR code
                ctx.drawImage(qrImage, padding, padding);

                // Add text
                ctx.font = '16px Moul';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                ctx.fillText(`ឈ្មោះ៖ ${formData.name}`, canvas.width / 2, canvas.height - 45);
                ctx.fillText(`លេខចុះឈ្មោះ៖ ${formData.registrationId}`, canvas.width / 2, canvas.height - 20);

                // Convert to image and download
                const link = document.createElement('a');
                link.download = `QR-${formData.registrationId}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };
    }
}

// Modal functions
function showModal() {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

function hideModal() {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Enable scrolling
}

// Success/Error message functions
function showSuccess() {
    successMessage.style.display = 'block';
    successMessage.textContent = 'ការចុះឈ្មោះបានជោគជ័យ!';
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 3000);
}

function showError(message = 'មានបញ្ហាកើតឡើង។ សូមព្យាយាមម្តងទៀត។') {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

// Event Listeners
closeButton.onclick = hideModal;

window.onclick = (event) => {
    if (event.target === modal) {
        hideModal();
    }
};

// Form input handlers for styling
const inputs = form.querySelectorAll('input, select');
inputs.forEach(input => {
    input.addEventListener('input', () => {
        if (input.value.trim() !== '') {
            input.classList.add('has-value');
        } else {
            input.classList.remove('has-value');
        }
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    modal.style.display = 'none';
    
    // Check online status
    if (!navigator.onLine) {
        showError('អ្នកកំពុងស្ថិតក្នុងម៉ូដគ្មានអ៊ីនធឺណិត។ ទិន្នន័យនឹងត្រូវបានរក្សាទុកនិងបញ្ជូនពេលមានអ៊ីនធឺណិត។');
    }
});

// Online/Offline status handlers
window.addEventListener('online', () => {
    showSuccess('បានភ្ជាប់ទៅអ៊ីនធឺណិតឡើងវិញ');
});

window.addEventListener('offline', () => {
    showError('បាត់ការភ្ជាប់អ៊ីនធឺណិត។ កំពុងធ្វើការក្នុងម៉ូដគ្មានអ៊ីនធឺណិត។');
});
