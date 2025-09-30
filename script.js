// ----------------------
// Contact Form Handling
// ----------------------

const levelOptions = {
  Vocal: [
    "Novice",
    "Beginner (Sarali, Janta, Alankaram)",
    "Intermediate (Varnam, a few Kriti)",
    "Advanced (Many Kriti-s, Manodharmam)"
  ],
  Veena: [
    "Novice",
    "Beginner (Sarali, Janta, Alankaram)",
    "Intermediate (Varnam, a few Kriti)",
    "Advanced (Many Kriti-s, Manodharmam)"
  ],
  Mridangam: [
    "Novice",
    "Beginner (initial lessons in Adi Tala)",
    "Intermediate (covered the 4 common Talas)",
    "Advanced (Other Tala-s and various Eduppu's etc)"
  ]
};

function updateLevelOptions() {
  const classSelect = document.getElementById("class");
  const levelSelect = document.getElementById("level");
  const selectedClass = classSelect.value;

  levelSelect.innerHTML = "";

  if (levelOptions[selectedClass]) {
    levelOptions[selectedClass].forEach(level => {
      const option = document.createElement("option");
      option.value = level;
      option.textContent = level;
      levelSelect.appendChild(option);
    });
  } else {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "-- Select Class First --";
    levelSelect.appendChild(option);
  }
}


const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", function(e) {
    e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const whatsapp = document.getElementById("whatsapp").value.trim();
        const classSelected = document.getElementById("class").value;
        const level = document.getElementById("level").value;
        const parentName = document.getElementById("parentName").value.trim();
        const comments = document.getElementById("comments").value.trim();

        if (!name || !email || !whatsapp || !classSelected || !level) {
            document.getElementById("formMessage").textContent = "Please fill all mandatory fields.";
            return;
        }

    const templateParams = {
    name: name,
    parent_name: parentName,
    email: email,
    whatsapp: whatsapp,
    class: classSelected,
    level: level,
    comments: comments
  };

    emailjs.send("service_wz91lqx", "template_3jp993o", templateParams)
  .then(function(response) {
    console.log("Email sent!", response.status, response.text);
    window.location.href = "thankyou.html";
  }, function(error) {
    console.error("EmailJS Error:", error);
    document.getElementById("formMessage").textContent =
      "❌ There was an error sending your message. Please try again.";
  });

    /*  // Simulate successful submission
        window.location.href = "thankyou.html"; */
        

    /* alert("Form submitted successfully! An email will be sent to chandrasekar.rama@gmail.com.");
    document.getElementById("formMessage").textContent = "";
    contactForm.reset();
    updateLevelOptions(); */
  });
}

// ----------------------
// Testimonial Carousel
// ----------------------

const testimonials = document.querySelectorAll('.testimonial');
if (testimonials.length > 0) {
  let index = 0;
  setInterval(() => {
    testimonials.forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
    index = (index + 1) % testimonials.length;
  }, 5000); // 5 seconds
}