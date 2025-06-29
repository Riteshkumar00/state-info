const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

// 👉 Static file paths
app.use('/css', express.static(path.join(__dirname, '../css')));
app.use('/js', express.static(__dirname));
app.use('/', express.static(path.join(__dirname, '../Pages')));

// ✅ MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'golu@222122',
  database: 'india_info'
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ MySQL connected');
});

// ✅ API to fetch state data with district list
app.get('/api/state', (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'State name is required' });

  db.query('SELECT * FROM states WHERE name = ?', [name], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'State not found' });

    const state = results[0];

    // Fetch CM info from `cms` table
    db.query('SELECT * FROM cms WHERE LOWER(state) = LOWER(?)', [name], (err2, cmResults) => {
      if (err2) return res.status(500).json({ error: 'Database error (CM)' });

      if (cmResults.length > 0) {
        const cmRow = cmResults[0];
        state.cm = {
          name: cmRow.name,
          photo: cmRow.photo,
          bio: cmRow.bio
        };
      }

      // 🔁 CM hardcoded overrides
      const lowerName = name.toLowerCase();
      if (lowerName === 'bihar') {
        state.cm = {
          name: 'Nitish Kumar',
          photo: 'https://state.bihar.gov.in/biharprd/cache/33/HOME_IMAGES/cmnitishkumar.jpeg',
          bio: 'Nitish Kumar is the current Chief Minister of Bihar, known for infrastructure development, governance reforms, and social welfare programs.'
        };
      } else if (lowerName === 'andhra pradesh') {
        state.cm = {
          name: 'Y. S. Jagan Mohan Reddy',
          photo: 'https://www.ap.gov.in/assets/images/apnewcm.png',
          bio: 'Chief Minister of Andhra Pradesh, known for launching various welfare schemes such as Amma Vodi, YSR Rythu Bharosa, and initiatives to uplift rural development and education.'
        };
      } else if (lowerName === 'arunachal pradesh') {
        state.cm = {
          name: 'Pema Khandu',
          photo: 'https://arunachalpradesh.gov.in/images/cm-img.jpg',
          bio: 'Pema Khandu is the Chief Minister of Arunachal Pradesh, known for infrastructure development, promoting digital governance, and working to improve connectivity and education in remote areas.'
        };
      } else if (lowerName === 'assam') {
        state.cm = {
          name: 'Himanta Biswa Sarma',
          photo: 'https://newslivetv.com/wp-content/uploads/2021/05/himanta-biswa-sarma.jpg',
          bio: 'He is the Chief Minister of Assam since 2021. A dynamic leader known for administrative reforms, infrastructure development, and initiatives in healthcare, education, and digital governance.'
        };
      } else if (lowerName === 'chhattisgarh') {
        state.cm = {
          name: 'Vishnu Deo Sai',
          photo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRE4AmxZdNzrqz1aUYtx0tDhtZa_0JfIY7fWQ&s',
          bio: 'Vishnu Deo Sai is the current Chief Minister of Chhattisgarh, known for his focus on tribal welfare, rural development, and social inclusion. He has a strong political background and represents the aspirations of the people of the state.'
        };
      } else if (lowerName === 'goa') {
        state.cm = {
          name: 'Dr. Pramod Sawant',
          photo: 'https://www.drpramodsawant.in/images/cm-img.png',
          bio: 'A qualified Ayurveda practitioner, he has served as Speaker of the Goa Legislative Assembly before becoming CM in 2019. His leadership focuses on infrastructure development, digital initiatives, and tourism growth.'
        };
      } else if (lowerName === 'gujarat') {
        state.cm = {
          name: 'Bhupendrabhai Patel',
          photo: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Bhupendrabhai_Patel_accompanies_Narendra_Modi_at_Rajkot_%28cropped%29.jpg',
          bio: 'Bhupendrabhai Patel is the current Chief Minister of Gujarat since 2021. A member of the Bharatiya Janata Party (BJP), he represents the Ghatlodia constituency. Known for his calm demeanor and administrative experience, he emphasizes infrastructure development, education, and digital governance in the state.'
        };
      } else if (lowerName === 'haryana') {
        state.cm = {
          name: 'Nayab Singh Saini',
          photo: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Nayab_Singh_Saini_2023.jpg',
          bio: 'Nayab Singh Saini is the current Chief Minister of Haryana as of March 2024. A leader of the Bharatiya Janata Party (BJP), he has represented the Kurukshetra Lok Sabha constituency and later served in the state assembly. He is known for his grassroots approach and focus on infrastructure and public welfare programs.'
        };
      } else if (lowerName === 'himachal pradesh') {
        state.cm = {
          name: 'Sukhvinder Singh Sukhu',
          photo: 'https://upload.wikimedia.org/wikipedia/commons/b/b0/Sukhvinder_Singh_Sukhu.jpg',
          bio: 'Sukhvinder Singh Sukhu is the current Chief Minister of Himachal Pradesh. Known for prioritizing welfare reforms and sustainable development initiatives.'
        };
      } else if (lowerName === 'uttar pradesh') {
        state.cm = {
          name: 'Yogi Adityanath',
          photo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/The_Uttar_Pradesh_Chief_Minister%2C_Shri_Yogi_Adityanath_in_New_Delhi_on_February_10%2C_2018_%28cropped%29.jpg',
          bio: 'Yogi Adityanath is the current Chief Minister of Uttar Pradesh, serving since March 2017. His leadership focuses on infrastructure development, law and order, and religious tourism.'
        };
      } else if (lowerName === 'jharkhand') {
        state.cm = {
          name: 'Champai Soren',
          photo: 'https://upload.wikimedia.org/wikipedia/commons/6/69/Hemant_Soren_2024.jpg',
          bio: 'Champai Soren became the Chief Minister of Jharkhand in February 2024. A senior leader of the Jharkhand Mukti Morcha (JMM), he has been actively involved in tribal rights and state welfare programs.'
        };
      }

      // ➕ Fetch districts and group by division
      db.query('SELECT name, division FROM districts WHERE state = ?', [name], (err3, districtResults) => {
        if (err3) return res.status(500).json({ error: 'Database error (districts)' });

        const groupedDistricts = {};
        districtResults.forEach(({ name, division }) => {
          if (!groupedDistricts[division]) {
            groupedDistricts[division] = [];
          }
          groupedDistricts[division].push(name);
        });

        state.districtList = groupedDistricts;
        state.districts = districtResults.length;

        res.json(state);
      });
    });
  });
});

// ✅ API to fetch individual district data
app.get('/api/district', (req, res) => {
  const { state, district } = req.query;
  if (!state || !district) return res.status(400).json({ error: 'State and district are required' });

  db.query('SELECT * FROM districts WHERE state = ? AND name = ?', [state, district], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'District not found' });

    res.json(results[0]);
  });
});

// ✅ Start server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
