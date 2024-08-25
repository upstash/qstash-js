export const landingPage = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workflow Form</title>
  <style>
    /* Center the form on the page */
    body, html {
      font-family: Arial, sans-serif;
      height: 100%;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #f0f0f0; /* Background color for the page */
    }

    /* Outer wrapper with rounded edges */
    .form-container {
      background-color: white;
      padding: 20px;
      border-radius: 15px; /* Rounded edges */
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); /* Slight shadow for effect */
      width: 400px; /* Adjust this width as needed */
    }

    /* Form elements */
    #workflowForm {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    #workflowForm input[type="text"] {
      padding: 10px;
      width: 100%;
      max-width: 400px;
      border-radius: 5px;
      border: 1px solid #ccc;
      font-size: 12px;
      box-sizing: border-box; 
    }

    /* Button default style */
    #submitBtn {
      background-color: #3b82f6; /* Default color */
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 12px;
      width: 100%;
      max-width: 400px;
    }

    /* Button hover state */
    #submitBtn:hover {
      background-color: #2563eb; /* Hover color */
    }

    /* Button focus state */
    #submitBtn:focus {
      background-color: #6366f1; /* Focus color */
      outline: none;
    }

    /* Button pending state (when the request is being sent) */
    #submitBtn.pending {
      background-color: #6b7280; /* Pending color */
      cursor: not-allowed;
    }
  </style>
</head>
<body>

  <div class="form-container">
    <form id="workflowForm" action="/workflow" method="POST">
      <label for="inputText">Enter Request Body:</label><br><br>
      <input type="text" id="inputText" name="text"><br><br>
      <button type="submit" id="submitBtn">Trigger "/workflow" Endpoint</button>
    </form>
  </div>

  <script>
    document.getElementById('workflowForm').addEventListener('submit', function(event) {
      event.preventDefault(); // Prevent the form from submitting immediately

      var submitBtn = document.getElementById('submitBtn');
      submitBtn.classList.add('pending'); // Add the pending class

      var textValue = document.getElementById('inputText').value;

      fetch('/workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json' // Sending as JSON
        },
        body: JSON.stringify({ text: textValue }) // Converting form data to JSON
      }).then(function(response) {
        submitBtn.classList.remove('pending'); // Remove the pending class
      }).catch(function(error) {
        submitBtn.classList.remove('pending'); // Remove the pending class
        alert('Error: ' + error.message);
      });
    });
  </script>

</body>
</html>
`