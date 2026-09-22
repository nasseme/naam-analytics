# Data Analyst Platform — V1 (squelette)

Squelette fonctionnel du flux principal : **upload → détection de type → clarification si besoin → rapport**.

Pas encore branchés à ce stade : Supabase (persistance), export PDF, dashboard visuel (le rapport
s'affiche en JSON brut pour l'instant, le temps de valider la logique).

## Lancer le backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows : venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

L'API tourne sur http://localhost:8000. Doc interactive : http://localhost:8000/docs

## Lancer le frontend

```bash
cd frontend
npm install
npm run dev
```

Le site tourne sur http://localhost:3000

Si l'API tourne sur un autre port/URL, créer un fichier `.env.local` dans `frontend/` :
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Tester rapidement

Crée un `test.csv` avec des colonnes volontairement ambiguës pour voir le flux de clarification :

```csv
id_client,date_achat,montant,ville,age
01,03/04/2024,"120,50 €",Paris,34
02,04/05/2024,"80,00 €",Lyon,28
03,05/06/2024,"200,00 €",Paris,45
04,06/07/2024,"15,00 €",Marseille,51
```

## Prochaines étapes (voir le document de vision)

1. Brancher Supabase (table `reports`) pour la persistance par lien unique
2. Construire le vrai dashboard (cartes, tableaux, graphiques) à la place du JSON brut
3. Ajouter l'export PDF (WeasyPrint/Playwright)
4. V2 : Machine Learning (Isolation Forest, K-Means, classification/régression)
