// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { 
  getAuth, 
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged as firebaseAuthStateChanged,
  signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js';

export class AuthManager {
  constructor(onAuthStateChanged = null) {
    // Firebase configuration
    this.firebaseConfig = {
      apiKey: "AIzaSyCUtz9EKzsZGw4B_UB6JTfax9TIueQi0NM",
      authDomain: "tdscorchedearth.firebaseapp.com",
      projectId: "tdscorchedearth",
      storageBucket: "tdscorchedearth.firebasestorage.app",
      messagingSenderId: "138662468509",
      appId: "1:138662468509:web:78ab5f55c8c250205b6d74"
    };
    
    // Initialize Firebase
    this.app = initializeApp(this.firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.googleProvider = new GoogleAuthProvider();
    
    // Current user data
    this.currentUser = null;
    this.isInitialized = false;
    this.onUserAuthStateChanged = onAuthStateChanged;
    
    // Create auth UI elements
    this.createAuthUI();
    
    // Set up auth state listener
    this.setupAuthStateListener();
    
    // Check for redirect result immediately
    this.checkRedirectResult();
    
    // Check if user is already signed in
    this.checkCurrentUser();
  }
  
  // NEW METHOD: Check if user is already signed in
  checkCurrentUser() {
    // If there's already a user signed in, hide the auth screen
    if (this.auth.currentUser) {
      console.log("User already signed in:", this.auth.currentUser.displayName);
      this.hideAuthScreen();
    } else {
      // If no user is signed in, show the auth screen
      console.log("No user currently signed in, showing auth screen");
      this.showAuthScreen();
    }
  }
  
  async checkRedirectResult() {
    try {
      // Check if we have a redirect result (after user is redirected back from Google)
      const result = await getRedirectResult(this.auth);
      if (result) {
        // User has been successfully signed in
        // The auth state listener will handle updating the UI
        console.log("User signed in via redirect:", result.user);
        this.showToast(`Welcome, ${result.user.displayName || 'User'}!`);
        
        // Make sure to hide the auth screen
        this.hideAuthScreen();
      }
    } catch (error) {
      console.error("Error checking redirect result:", error);
      this.showToast('Authentication error. Please try again.', 'error');
    }
  }
  
  setupAuthStateListener() {
    firebaseAuthStateChanged(this.auth, async (user) => {
      if (user) {
        // User is signed in
        console.log("Auth state changed: User is signed in", user.displayName);
        
        const userData = {
          uid: user.uid,
          displayName: user.displayName || 'Player',
          email: user.email,
          photoURL: user.photoURL,
          isGuest: false,
          lastLogin: Date.now()
        };
        
        // Update user record in Firestore
        await this.updateUserRecord(userData);
        
        // Update local state
        this.currentUser = userData;
        this.updateProfileUI(userData);
        
        // Hide auth screen
        this.hideAuthScreen();
        
        // Call the callback if provided
        if (this.onUserAuthStateChanged) {
          this.onUserAuthStateChanged(userData);
        }
      } else {
        // User is signed out
        console.log("Auth state changed: User is signed out");
        this.currentUser = null;
        this.updateProfileUI(null);
        
        // Show auth screen again when signed out
        this.showAuthScreen();
        
        // Call the callback if provided
        if (this.onUserAuthStateChanged) {
          this.onUserAuthStateChanged(null);
        }
      }
    });
  }
  
  async updateUserRecord(userData) {
    try {
      // Reference to user document
      const userRef = doc(this.db, 'users', userData.uid);
      
      // Check if user document exists
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // Update existing user
        await updateDoc(userRef, {
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          lastLogin: userData.lastLogin
        });
        
        return userSnap.data();
      } else {
        // Create new user with initial data
        const newUserData = {
          ...userData,
          createdAt: Date.now(),
          resources: {
            credits: 1000,
            experience: 0,
            level: 1,
            victories: 0,
            defeats: 0,
            shotsFired: 0,
            tanksDestroyed: 0,
            gamesPlayed: 0
          },
          upgrades: {
            armorLevel: 1,
            firepower: 1,
            fuelEfficiency: 1,
            turretSpeed: 1,
            radarRange: 1,
            windResistance: 1
          },
          equipment: {
            tankColor: 0x22aa22,
            turretModel: 'basic',
            projectileType: 'basic'
          }
        };
        
        await setDoc(userRef, newUserData);
        return newUserData;
      }
    } catch (error) {
      console.error('Error updating user record:', error);
      this.showToast('Error saving user data', 'error');
      return null;
    }
  }
  
  async fetchUserData(uid) {
    try {
      const userRef = doc(this.db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        return userSnap.data();
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }
  
  createAuthUI() {
    // Create the auth container
    this.authContainer = document.createElement('div');
    this.authContainer.id = 'authContainer';
    this.authContainer.style.position = 'fixed';
    this.authContainer.style.top = '0';
    this.authContainer.style.left = '0';
    this.authContainer.style.width = '100%';
    this.authContainer.style.height = '100%';
    this.authContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.authContainer.style.display = 'flex';
    this.authContainer.style.justifyContent = 'center';
    this.authContainer.style.alignItems = 'center';
    this.authContainer.style.zIndex = '1000';
    this.authContainer.style.opacity = '0';
    this.authContainer.style.transition = 'opacity 0.3s ease';
    this.authContainer.style.pointerEvents = 'none';
    
    // Create the auth panel
    this.authPanel = document.createElement('div');
    this.authPanel.style.backgroundColor = '#222';
    this.authPanel.style.borderRadius = '8px';
    this.authPanel.style.padding = '20px';
    this.authPanel.style.width = '90%';
    this.authPanel.style.maxWidth = '400px';
    this.authPanel.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
    this.authPanel.style.textAlign = 'center';
    this.authPanel.style.color = 'white';
    
    // Create the auth header
    const authHeader = document.createElement('h2');
    authHeader.textContent = 'Sign In to 3D Scorched Earth';
    authHeader.style.marginBottom = '20px';
    this.authPanel.appendChild(authHeader);
    
    // Create the auth description
    const authDescription = document.createElement('p');
    authDescription.textContent = 'Sign in to save your progress, upgrade your tank, and compete with other players!';
    authDescription.style.marginBottom = '30px';
    authDescription.style.fontSize = '14px';
    authDescription.style.color = '#ccc';
    this.authPanel.appendChild(authDescription);
    
    // Create the Google sign in button
    this.googleButton = document.createElement('button');
    this.googleButton.className = 'google-sign-in';
    this.googleButton.innerHTML = `
      <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNOSAzLjQ4YzEuNjkgMCAyLjgzLjcyIDMuNDggMS4zNGwyLjU0LTIuNDhDMTMuNDYuODkgMTEuNDMgMCA5IDAgNS40OCAwIDIuNDQgMi4wMi45NiA0Ljk2bDIuOTMgMi4yOEMzLjYgNS4zMiA2LjA3IDMuNDggOSAzLjQ4eiIgZmlsbD0iI0VBNDMzNSIvPjxwYXRoIGQ9Ik0xNy42NCA5LjJjMC0uNjMtLjA2LTEuMjUtLjE2LTEuOEg5djMuMzRoNC45Yy0uMjQgMS4xNy0uODYgMi4xNC0xLjgyIDIuNzdsMS45OSAxLjUzYzEuMTYtMS4wOCAxLjgzLTIuNjggMS44NC00Ljg0eiIgZmlsbD0iIzQyODVGNCIvPjxwYXRoIGQ9Ik0zLjg4IDE0LjdBOC45OSA4Ljk5IDAgMCAwIDkgMThjMi40MyAwIDQuNDctLjgiIGZpbGw9IiMzNEE4NTMiLz48cGF0aCBkPSJNMy44OSAxNC43eiIgZmlsbD0iIzE4ODE4MCIvPjxwYXRoIGQ9Ik0zLjg5IDE0LjdjLS42LS41OC0xLjA4LTEuMjktMS40NS0yLjA4TDAgMTEuMWMuOTUgMS44NyAyLjUyIDMuMzEgNC40NyAzLjZ6IiBmaWxsPSIjRkJCQzA1Ii8+PC9nPjwvc3ZnPg==" width="18" height="18">
      <span>Sign in with Google</span>
    `;
    this.googleButton.style.display = 'flex';
    this.googleButton.style.alignItems = 'center';
    this.googleButton.style.justifyContent = 'center';
    this.googleButton.style.width = '100%';
    this.googleButton.style.padding = '10px 15px';
    this.googleButton.style.backgroundColor = 'white';
    this.googleButton.style.color = '#444';
    this.googleButton.style.border = 'none';
    this.googleButton.style.borderRadius = '4px';
    this.googleButton.style.fontSize = '14px';
    this.googleButton.style.fontWeight = 'bold';
    this.googleButton.style.cursor = 'pointer';
    this.googleButton.style.gap = '10px';
    this.googleButton.addEventListener('click', () => this.signInWithGoogle());
    this.authPanel.appendChild(this.googleButton);
    
    // Create the play as guest button
    this.guestButton = document.createElement('button');
    this.guestButton.className = 'guest-button';
    this.guestButton.textContent = 'Play as Guest';
    this.guestButton.style.width = '100%';
    this.guestButton.style.marginTop = '15px';
    this.guestButton.style.padding = '10px 15px';
    this.guestButton.style.backgroundColor = 'transparent';
    this.guestButton.style.color = '#aaa';
    this.guestButton.style.border = '1px solid #555';
    this.guestButton.style.borderRadius = '4px';
    this.guestButton.style.fontSize = '14px';
    this.guestButton.style.cursor = 'pointer';
    this.guestButton.addEventListener('click', () => this.signInAsGuest());
    this.authPanel.appendChild(this.guestButton);
    
    // Create the privacy policy link
    const privacyLink = document.createElement('p');
    privacyLink.innerHTML = 'By signing in, you agree to our <a href="#" style="color: #4285F4; text-decoration: none;">Privacy Policy</a>';
    privacyLink.style.marginTop = '20px';
    privacyLink.style.fontSize = '12px';
    privacyLink.style.color = '#888';
    this.authPanel.appendChild(privacyLink);
    
    // Add the auth panel to the container
    this.authContainer.appendChild(this.authPanel);
    
    // Add the container to the document
    document.body.appendChild(this.authContainer);
    
    // User profile section (hidden initially)
    this.createUserProfile();
  }
  
  createUserProfile() {
    // Create the user profile container
    this.profileContainer = document.createElement('div');
    this.profileContainer.id = 'profileContainer';
    this.profileContainer.style.position = 'fixed';
    this.profileContainer.style.top = '10px';
    this.profileContainer.style.right = '10px';
    this.profileContainer.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
    this.profileContainer.style.borderRadius = '40px';
    this.profileContainer.style.padding = '5px';
    this.profileContainer.style.display = 'flex';
    this.profileContainer.style.alignItems = 'center';
    this.profileContainer.style.zIndex = '900';
    this.profileContainer.style.cursor = 'pointer';
    this.profileContainer.style.transition = 'all 0.3s ease';
    this.profileContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
    this.profileContainer.style.opacity = '0';
    this.profileContainer.style.transform = 'translateY(-20px)';
    this.profileContainer.style.pointerEvents = 'none';
    
    // Create the profile avatar
    this.profileAvatar = document.createElement('img');
    this.profileAvatar.className = 'profile-avatar';
    this.profileAvatar.style.width = '30px';
    this.profileAvatar.style.height = '30px';
    this.profileAvatar.style.borderRadius = '50%';
    this.profileAvatar.style.objectFit = 'cover';
    this.profileAvatar.style.border = '2px solid #4285F4';
    this.profileAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9ImZlYXRoZXIgZmVhdGhlci11c2VyIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';
    this.profileContainer.appendChild(this.profileAvatar);
    
    // Create the profile name
    this.profileName = document.createElement('span');
    this.profileName.className = 'profile-name';
    this.profileName.style.color = 'white';
    this.profileName.style.marginLeft = '10px';
    this.profileName.style.marginRight = '10px';
    this.profileName.style.fontSize = '14px';
    this.profileName.style.fontWeight = 'bold';
    this.profileName.style.whiteSpace = 'nowrap';
    this.profileName.textContent = 'Guest';
    this.profileContainer.appendChild(this.profileName);
    
    // Create dropdown menu
    this.createProfileMenu();
    
    // Add click event to toggle menu
    this.profileContainer.addEventListener('click', () => this.toggleProfileMenu());
    
    // Add the profile container to the document
    document.body.appendChild(this.profileContainer);
  }
  
  createProfileMenu() {
    // Create the profile menu
    this.profileMenu = document.createElement('div');
    this.profileMenu.id = 'profileMenu';
    this.profileMenu.style.position = 'absolute';
    this.profileMenu.style.top = 'calc(100% + 5px)';
    this.profileMenu.style.right = '0';
    this.profileMenu.style.backgroundColor = 'rgba(30, 30, 30, 0.9)';
    this.profileMenu.style.borderRadius = '8px';
    this.profileMenu.style.padding = '10px 0';
    this.profileMenu.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    this.profileMenu.style.display = 'none';
    this.profileMenu.style.minWidth = '150px';
    
    // Create menu items
    const menuItems = [
      { 
        text: 'My Profile', 
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9ImZlYXRoZXIgZmVhdGhlci11c2VyIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+',
        action: () => this.showProfile() 
      },
      { 
        text: 'Upgrades', 
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9ImZlYXRoZXIgZmVhdGhlci10b29sIj48cGF0aCBkPSJNMTQuNyA2LjNhMSAxIDAgMCAwIDAgMS40bC0xLjYgMS42YTEgMSAwIDAgMSAtMS40IDBMMTAuNSA4LjFhMSAxIDAgMCAxIDAtMS40bDItMmEzLjEgMy4xIDAgMCAxIDIuMiAtLjlIMTZhMyAzIDAgMCAxIDMgM3YxLjhNOC43IDE0LjdhMSAxIDAgMCAxLS4zLjctTDUgMTlsLTIgLTIgMy42LTMuNGExIDEgMCAwIDEgMS40IDBsLjcuN00xOSAxNnYzYTIgMiAwIDAgMS0yIDJoLTFhMy43IDMuNyAwIDAgMS0yLjctMS4xTDIgOC44VjYuNUwzLjUgNWMuOCAwIDEuNS41IDEuOCAxLjJMMTEgMTVoMmExIDEgMCAwIDEgMSAxdjFhMSAxIDAgMCAwIDEgMWgyYTEgMSAwIDAgMCAxLTF2LTJhMSAxIDAgMCAwLTEtMWgtM2ExIDEgMCAwIDEtMS0xdi0xYTEgMSAwIDAgMCAtMS0xaC0xYTEgMSAwIDAgMSAtMS0xdi0xYTEgMSAwIDAgMC0xLTFIOWExIDEgMCAwIDAtMS0xSDdhMSAxIDAgMCAwLTEgMUw1LjI1IDEwIi8+PC9zdmc+',
        action: () => this.showUpgrades() 
      },
      { 
        text: 'Stats', 
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9ImZlYXRoZXIgZmVhdGhlci1iYXItY2hhcnQtMiI+PGxpbmUgeDE9IjE4IiB5MT0iMjAiIHgyPSIxOCIgeTI9IjEwIj48L2xpbmU+PGxpbmUgeDE9IjEyIiB5MT0iMjAiIHgyPSIxMiIgeTI9IjQiPjwvbGluZT48bGluZSB4MT0iNiIgeTE9IjIwIiB4Mj0iNiIgeTI9IjE0Ij48L2xpbmU+PC9zdmc+',
        action: () => this.showStats() 
      },
      { 
        text: 'Sign Out', 
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9ImZlYXRoZXIgZmVhdGhlci1sb2ctb3V0Ij48cGF0aCBkPSJNOSAyMUg1YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yaDQiPjwvcGF0aD48cG9seWxpbmUgcG9pbnRzPSIxNiAxNyAyMSAxMiAxNiA3Ij48L3BvbHlsaW5lPjxsaW5lIHgxPSIyMSIgeTE9IjEyIiB4Mj0iOSIgeTI9IjEyIj48L2xpbmU+PC9zdmc+',
        action: () => this.signOut(),
        divider: true
      }
    ];
    
    // Create each menu item
    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'profile-menu-item';
      menuItem.style.padding = '8px 15px';
      menuItem.style.display = 'flex';
      menuItem.style.alignItems = 'center';
      menuItem.style.gap = '10px';
      menuItem.style.color = 'white';
      menuItem.style.cursor = 'pointer';
      menuItem.style.transition = 'background-color 0.2s ease';
      
      // Add divider if specified
      if (item.divider && index > 0) {
        const divider = document.createElement('div');
        divider.style.height = '1px';
        divider.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        divider.style.margin = '5px 15px';
        this.profileMenu.appendChild(divider);
      }
      
      // Add hover effect
      menuItem.addEventListener('mouseover', () => {
        menuItem.style.backgroundColor = 'rgba(66, 133, 244, 0.2)';
      });
      menuItem.addEventListener('mouseout', () => {
        menuItem.style.backgroundColor = 'transparent';
      });
      
      // Add icon
      const icon = document.createElement('img');
      icon.src = item.icon;
      icon.style.width = '16px';
      icon.style.height = '16px';
      menuItem.appendChild(icon);
      
      // Add text
      const text = document.createElement('span');
      text.textContent = item.text;
      text.style.fontSize = '14px';
      menuItem.appendChild(text);
      
      // Add click handler
      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideProfileMenu();
        if (item.action) item.action();
      });
      
      this.profileMenu.appendChild(menuItem);
    });
    
    this.profileContainer.appendChild(this.profileMenu);
  }
  
  toggleProfileMenu() {
    if (this.profileMenu.style.display === 'none') {
      this.showProfileMenu();
    } else {
      this.hideProfileMenu();
    }
  }
  
  showProfileMenu() {
    this.profileMenu.style.display = 'block';
    
    // Add click outside listener to close menu
    setTimeout(() => {
      document.addEventListener('click', this.handleOutsideClick);
    }, 10);
  }
  
  hideProfileMenu() {
    this.profileMenu.style.display = 'none';
    document.removeEventListener('click', this.handleOutsideClick);
  }
  
  handleOutsideClick = (e) => {
    if (!this.profileMenu.contains(e.target) && e.target !== this.profileContainer) {
      this.hideProfileMenu();
    }
  }
  
  showAuthScreen() {
    this.authContainer.style.opacity = '1';
    this.authContainer.style.pointerEvents = 'auto';
  }
  
  hideAuthScreen() {
    this.authContainer.style.opacity = '0';
    this.authContainer.style.pointerEvents = 'none';
  }
  
  showProfile() {
    alert('Profile feature coming soon!');
  }
  
  showUpgrades() {
    alert('Upgrades feature coming soon!');
  }
  
  showStats() {
    alert('Stats feature coming soon!');
  }
  
  updateProfileUI(user) {
    if (!user) {
      this.profileContainer.style.opacity = '0';
      this.profileContainer.style.transform = 'translateY(-20px)';
      this.profileContainer.style.pointerEvents = 'none';
      return;
    }
    
    // Update avatar if available
    if (user.photoURL) {
      this.profileAvatar.src = user.photoURL;
    } else {
      // Default avatar
      this.profileAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9ImZlYXRoZXIgZmVhdGhlci11c2VyIj48cGF0aCBkPSJNMjAgMjF2LTJhNCA0IDAgMCAwLTQtNEg4YTQgNCAwIDAgMC00IDR2MiI+PC9wYXRoPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCI+PC9jaXJjbGU+PC9zdmc+';
    }
    
    // Update name
    this.profileName.textContent = user.displayName || 'Guest';
    
    // Show profile UI
    this.profileContainer.style.opacity = '1';
    this.profileContainer.style.transform = 'translateY(0)';
    this.profileContainer.style.pointerEvents = 'auto';
  }
  
  async signInWithGoogle() {
    try {
      // First check if already signed in
      if (this.auth.currentUser) {
        console.log("User already signed in:", this.auth.currentUser.displayName);
        this.hideAuthScreen();
        return;
      }
      
      this.setLoading(true);
      this.showToast('Redirecting to Google login...', 'info');
      
      // Try popup first, then fallback to redirect
      try {
        const result = await signInWithPopup(this.auth, this.googleProvider);
        console.log("User signed in via popup:", result.user);
        this.showToast(`Welcome, ${result.user.displayName || 'User'}!`);
        this.hideAuthScreen();
      } catch (popupError) {
        console.error('Google popup sign in error:', popupError);
        
        // If popup fails, try redirect
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/cancelled-popup-request' ||
            popupError.code === 'auth/popup-closed-by-user') {
          this.showToast('Popup blocked. Trying redirect method...', 'info');
          await signInWithRedirect(this.auth, this.googleProvider);
        } else if (popupError.code === 'auth/unauthorized-domain') {
          // Special handling for unauthorized domain
          this.showToast('This domain is not authorized for Firebase auth. Please check Firebase console.', 'error');
        } else {
          this.showToast('Sign in failed. Trying redirect method...', 'info');
          await signInWithRedirect(this.auth, this.googleProvider);
        }
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      this.showToast('Sign in failed. Please try again.', 'error');
    } finally {
      this.setLoading(false);
    }
  }
  
  async signInAsGuest() {
    // Create guest user in local memory only (not in Firebase)
    const guestUser = {
      uid: 'guest-' + Math.random().toString(36).substring(2, 11),
      displayName: 'Guest Player',
      photoURL: null,
      isGuest: true,
      createdAt: Date.now(),
      lastLogin: Date.now()
    };
    
    // Update local state
    this.currentUser = guestUser;
    this.updateProfileUI(guestUser);
    this.hideAuthScreen();
    
    // Call the callback if provided
    if (this.onUserAuthStateChanged) {
      this.onUserAuthStateChanged(guestUser);
    }
    
    // Show guest welcome
    this.showToast('Playing as guest. Sign in to save your progress!', 'info');
  }
  
  async signOut() {
    try {
      // Firebase sign out
      await firebaseSignOut(this.auth);
      
      // Update UI
      this.updateProfileUI(null);
      
      // Show sign out message
      this.showToast('Signed out successfully');
      
      // Show auth screen again
      setTimeout(() => {
        this.showAuthScreen();
      }, 1000);
      
    } catch (error) {
      console.error('Sign out error:', error);
      this.showToast('Error signing out', 'error');
    }
  }
  
  getCurrentUser() {
    return this.currentUser || this.auth.currentUser;
  }
  
  isUserLoggedIn() {
    return !!this.auth.currentUser;
  }
  
  setLoading(isLoading) {
    this.googleButton.disabled = isLoading;
    this.guestButton.disabled = isLoading;
    
    if (isLoading) {
      this.googleButton.innerHTML = `
        <div class="spinner" style="width: 18px; height: 18px; border: 2px solid rgba(0, 0, 0, 0.1); border-top-color: #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>Signing in...</span>
      `;
      
      // Add spinner animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    } else {
      this.googleButton.innerHTML = `
        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNOSAzLjQ4YzEuNjkgMCAyLjgzLjcyIDMuNDggMS4zNGwyLjU0LTIuNDhDMTMuNDYuODkgMTEuNDMgMCA5IDAgNS40OCAwIDIuNDQgMi4wMi45NiA0Ljk2bDIuOTMgMi4yOEMzLjYgNS4zMiA2LjA3IDMuNDggOSAzLjQ4eiIgZmlsbD0iI0VBNDMzNSIvPjxwYXRoIGQ9Ik0xNy42NCA5LjJjMC0uNjMtLjA2LTEuMjUtLjE2LTEuOEg5djMuMzRoNC45Yy0uMjQgMS4xNy0uODYgMi4xNC0xLjgyIDIuNzdsMS45OSAxLjUzYzEuMTYtMS4wOCAxLjgzLTIuNjggMS44NC00Ljg0eiIgZmlsbD0iIzQyODVGNCIvPjxwYXRoIGQ9Ik0zLjg4IDE0LjdBOC45OSA4Ljk5IDAgMCAwIDkgMThjMi40MyAwIDQuNDctLjgiIGZpbGw9IiMzNEE4NTMiLz48cGF0aCBkPSJNMy44OSAxNC43eiIgZmlsbD0iIzE4ODE4MCIvPjxwYXRoIGQ9Ik0zLjg5IDE0LjdjLS42LS41OC0xLjA4LTEuMjktMS40NS0yLjA4TDAgMTEuMWMuOTUgMS44NyAyLjUyIDMuMzEgNC40NyAzLjZ6IiBmaWxsPSIjRkJCQzA1Ii8+PC9nPjwvc3ZnPg==" width="18" height="18">
        <span>Sign in with Google</span>
      `;
    }
  }
  
  showToast(message, type = 'success') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.style.position = 'fixed';
      toastContainer.style.bottom = '20px';
      toastContainer.style.left = '20px';
      toastContainer.style.zIndex = '1000';
      document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.backgroundColor = type === 'error' ? '#f44336' : (type === 'info' ? '#2196F3' : '#4CAF50');
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '4px';
    toast.style.marginTop = '10px';
    toast.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.minWidth = '200px';
    toast.style.maxWidth = '300px';
    toast.style.transform = 'translateX(-100%)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.3s ease';
    
    // Add icon based on type
    const icon = document.createElement('div');
    icon.style.marginRight = '10px';
    
    if (type === 'error') {
      icon.innerHTML = '⚠️';
    } else if (type === 'info') {
      icon.innerHTML = 'ℹ️';
    } else {
      icon.innerHTML = '✓';
    }
    
    toast.appendChild(icon);
    
    // Add message
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    toast.appendChild(messageElement);
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
      toast.style.transform = 'translateX(-100%)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
}