curl 'http://localhost:3000/auth' \
  -X POST \
  --data-raw '{"date":123,"email":"my@mail.com","amount":10}' \
  --header "Authentication: Bearer secretPassword"