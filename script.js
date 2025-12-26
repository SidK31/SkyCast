const cityInput = document.querySelector("#cityInput");
const searchBtn = document.querySelector("#searchBtn");
const result = document.querySelector("#result");

// Replace with your OpenWeatherMap API key
const API_KEY = "b6c34a770cb8ad23c546bdf9d149422a";

async function getWeather(city) {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("City not found");
    }

    const data = await response.json();
    return data;
}

function displayWeather(data) {
    const cityName = data.name;
    const temperature = Math.round(data.main.temp);
    const condition = data.weather[0].description;

    result.innerHTML = `
        <strong>${cityName}</strong><br>
        ${temperature}°C<br>
        ${condition}
    `;
}

function displayError(message) {
    result.innerText = message;
}

searchBtn.addEventListener("click", async function () {
    const city = cityInput.value.trim();

    if (city === "") {
        displayError("Please enter a city name.");
        return;
    }

    result.innerText = "Loading...";

    try {
        const weatherData = await getWeather(city);
        displayWeather(weatherData);
    } catch (error) {
        displayError("City not found. Please try again.");
    }
});
