// Define the name of your Power-Up
var POWER_UP_NAME = 'Custom Button Power-Up';

var onBtnClick = function(t, opts) {
    console.log('Button clicked on card:', opts);

    return t.card('all')
        .then(function(card) {
            console.log('Card data:', card);

            // Get the card title
            const cardTitle = card.name;

            // Find the custom fields with specific IDs
            const orgNumField = card.customFieldItems.find(field => field.idCustomField === '66deaa1c355f14009a688b5d');
            const hubspotIdField = card.customFieldItems.find(field => field.idCustomField === '66d715a7584d0c33d06ab06f');

            let orgNum = '';
            let hubspotId = '';

            // Extract values from custom fields
            if (orgNumField && orgNumField.value) {
                orgNum = orgNumField.value.text || '';
            }
            if (hubspotIdField && hubspotIdField.value) {
                hubspotId = hubspotIdField.value.text || hubspotIdField.value.number || '';
            }

            console.log('OrgNum:', orgNum);
            console.log('HubSpot ID:', hubspotId);

            // Get the user information
            return t.member('fullName').then(function(member) {
                const userName = member.fullName;  // Get the full name of the current user

                // Get labels from the card
                const labels = card.labels.map(label => label.name).join(',');

                // URL of the page you want to display in the popup, including cardTitle and userName
                var externalUrl = `https://activateitems-d22e28f2e719.herokuapp.com/?hubspotId=${hubspotId}&labels=${encodeURIComponent(labels)}&cardTitle=${encodeURIComponent(cardTitle)}&userName=${encodeURIComponent(userName)}`;
                
                // Construct the backend proxy URL
                const proxyUrl = '/proxy-younium-orders';
                
                // Log the proxy URL and the body being sent
                console.log(`POST to proxy URL: ${proxyUrl}`);
                console.log(`POST body: OrgNo: ${orgNum}, HubspotDealId: ${hubspotId}`);

                // Make API call to backend to proxy the external API
                fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ OrgNo: orgNum, HubspotDealId: hubspotId })
                })
                .then(response => {
                    console.log('API response:', response);
                    return response.json();
                })
                .then(data => {
                    console.log('Parsed API Response:', data);

                    // Extract account information
                    if (data && data.length > 0) {
                        const accountInfo = data[0].account;
                        const accountName = accountInfo.name;
                        const accountNumber = accountInfo.accountNumber;

                        // Display the account information in the popup
                        alert(`Account Name: ${accountName}\nAccount Number: ${accountNumber}`);
                    } else {
                        alert('No data found for this OrgNo and HubSpot ID.');
                    }
                })
                .catch(error => {
                    console.error('Error fetching API data:', error);
                    alert('Error fetching API data.');
                });

                return t.popup({
                    title: 'Klarmarkering',
                    url: externalUrl,
                    height: 800,
                    width: 1000
                }).then(() => {
                    console.log('Popup displayed successfully with HubSpot ID, labels, card title, and user name:', hubspotId, labels, cardTitle, userName);
                }).catch(err => {
                    console.error('Error displaying popup:', err);
                });
            });
        });
};

TrelloPowerUp.initialize({
    'card-buttons': function(t, options) {
        console.log('Initializing card-buttons capability');
        return [{
            icon: 'https://activateitems-d22e28f2e719.herokuapp.com/favicon.ico',
            text: 'Klarmarkering',
            callback: onBtnClick
        }];
    }
});
