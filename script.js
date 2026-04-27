document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Add to cart interaction
    const addToCartBtns = document.querySelectorAll('.add-to-cart');
    const cartBadge = document.querySelector('.badge');
    let cartCount = parseInt(cartBadge.innerText);

    addToCartBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Increment cart
            cartCount++;
            cartBadge.innerText = cartCount;
            
            // Simple animation
            this.innerHTML = '<i class="fa-solid fa-check"></i>';
            this.style.backgroundColor = 'var(--primary)';
            this.style.color = 'white';
            
            // Reset after 2 seconds
            setTimeout(() => {
                this.innerHTML = '<i class="fa-solid fa-plus"></i>';
                this.style.backgroundColor = '';
                this.style.color = '';
            }, 2000);
            
            // Add a little pop animation to the badge
            cartBadge.style.transform = 'scale(1.5)';
            setTimeout(() => {
                cartBadge.style.transform = 'scale(1)';
            }, 200);
        });
    });

    // Search Interaction
    const searchBtn = document.querySelector('.search-btn');
    const searchInput = document.querySelector('.search-box input');

    searchBtn.addEventListener('click', () => {
        if (searchInput.value.trim() !== '') {
            searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            
            setTimeout(() => {
                searchBtn.innerHTML = 'Search';
                searchInput.value = '';
                alert('Search functionality will be connected to the backend API.');
            }, 1000);
        }
    });
});
