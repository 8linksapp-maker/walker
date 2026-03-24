$(window).on('load', function(){
    "use strict";
    $("#preloader").delay(750).fadeOut('slow');
});

$(document).ready(function() {
    "use strict";

    /*=========================================================================
            Slick sliders
    =========================================================================*/
    if ($('.post-carousel-lg').length) {
      $('.post-carousel-lg').slick({
        dots: true,
        arrows: true,
        slidesToShow: 1,
        slidesToScroll: 1,
        fade: true,
        cssEase: 'linear',
        responsive: [
          {
            breakpoint: 768,
            settings: { slidesToShow: 1, slidesToScroll: 1, dots: true, arrows: false }
          }
        ]
      });
    }

    if ($('.post-carousel-featured').length) {
      $('.post-carousel-featured').slick({
        dots: true,
        arrows: false,
        slidesToShow: 5,
        slidesToScroll: 2,
        responsive: [
          { breakpoint: 1440, settings: { slidesToShow: 4, slidesToScroll: 4, dots: true, arrows: false } },
          { breakpoint: 1024, settings: { slidesToShow: 3, slidesToScroll: 3, dots: true, arrows: false } },
          { breakpoint: 768,  settings: { slidesToShow: 2, slidesToScroll: 2, dots: true, arrows: false } },
          { breakpoint: 576,  settings: { slidesToShow: 1, slidesToScroll: 1, dots: true, arrows: false } }
        ]
      });
    }

    if ($('.post-carousel-twoCol').length) {
      $('.post-carousel-twoCol').slick({
        dots: false,
        arrows: false,
        slidesToShow: 2,
        slidesToScroll: 1,
        responsive: [
          { breakpoint: 768, settings: { slidesToShow: 2, slidesToScroll: 2, dots: false, arrows: false } },
          { breakpoint: 576, settings: { slidesToShow: 1, slidesToScroll: 1, dots: false, arrows: false } }
        ]
      });
      $('.carousel-topNav-prev').click(function(){ $('.post-carousel-twoCol').slick('slickPrev'); });
      $('.carousel-topNav-next').click(function(){ $('.post-carousel-twoCol').slick('slickNext'); });
    }

    if ($('.post-carousel-widget').length) {
      $('.post-carousel-widget').slick({
        dots: false,
        arrows: false,
        slidesToShow: 1,
        slidesToScroll: 1,
        responsive: [
          { breakpoint: 991, settings: { slidesToShow: 2, slidesToScroll: 1 } },
          { breakpoint: 576, settings: { slidesToShow: 1, centerMode: true, slidesToScroll: 1 } }
        ]
      });
      $('.carousel-botNav-prev').click(function(){ $('.post-carousel-widget').slick('slickPrev'); });
      $('.carousel-botNav-next').click(function(){ $('.post-carousel-widget').slick('slickNext'); });
    }

    /*=========================================================================
            Sticky header
    =========================================================================*/
    var $header = $(".header-default, .header-personal nav, .header-classic .header-bottom"),
      $clone = $header.before($header.clone().addClass("clone"));

    $(window).on("scroll", function() {
      var fromTop = $(window).scrollTop();
      $('body').toggleClass("down", (fromTop > 300));
    });

});

$(function(){
    "use strict";

    /*=========================================================================
            Sticky Sidebar
    =========================================================================*/
    if ($('.sidebar').length && typeof $.fn.stickySidebar !== 'undefined') {
      $('.sidebar').stickySidebar({
        topSpacing: 60,
        bottomSpacing: 30,
        containerSelector: '.main-content',
      });
    }

    /*=========================================================================
            Vertical Menu
    =========================================================================*/
    $(".submenu").before('<i class="icon-arrow-down switch"></i>');

    $(".vertical-menu li i.switch").on('click', function() {
      var $submenu = $(this).next(".submenu");
      $submenu.slideToggle(300);
      $submenu.parent().toggleClass("openmenu");
    });

    /*=========================================================================
            Canvas Menu
    =========================================================================*/
    $("button.burger-menu").on('click', function() {
      $(".canvas-menu").toggleClass("open");
      $(".main-overlay").toggleClass("active");
    });

    $(".canvas-menu .btn-close, .main-overlay").on('click', function() {
      $(".canvas-menu").removeClass("open");
      $(".main-overlay").removeClass("active");
    });

    /*=========================================================================
            Popups
    =========================================================================*/
    $("button.search").on('click', function() {
      $(".search-popup").addClass("visible");
    });

    $(".search-popup .btn-close").on('click', function() {
      $(".search-popup").removeClass("visible");
    });

    $(document).keyup(function(e) {
      if (e.key === "Escape") {
        $(".search-popup").removeClass("visible");
      }
    });

    /*=========================================================================
            Tabs loader
    =========================================================================*/
    $('button[data-bs-toggle="tab"]').on('click', function() {
      $(".tab-pane").addClass("loading");
      $('.lds-dual-ring').addClass("loading");
      setTimeout(function() {
        $(".tab-pane").removeClass("loading");
        $('.lds-dual-ring').removeClass("loading");
      }, 500);
    });

    /*=========================================================================
            Social share toggle
    =========================================================================*/
    $('.post button.toggle-button').each(function() {
      $(this).on('click', function(e) {
        $(this).next('.social-share .icons').toggleClass("visible");
        $(this).toggleClass('icon-close').toggleClass('icon-share');
      });
    });

    /*=========================================================================
            Spacer with Data Attribute
    =========================================================================*/
    var spacers = document.getElementsByClassName('spacer');
    for (var i = 0; i < spacers.length; i++) {
      var size = spacers[i].getAttribute('data-height');
      spacers[i].style.height = "" + size + "px";
    }

    /*=========================================================================
            Background Image with Data Attribute
    =========================================================================*/
    var bgImages = document.getElementsByClassName('data-bg-image');
    for (var i = 0; i < bgImages.length; i++) {
      var bgimage = bgImages[i].getAttribute('data-bg-image');
      bgImages[i].style.backgroundImage = "url('" + bgimage + "')";
    }

});
