export const KNOWN_INGREDIENTS = [
  "gin","rye","bourbon","whiskey","rum","vodka","tequila","cognac","brandy","scotch",
  "campari","cynar","chartreuse","maraschino","vermouth","aperol","sherry","amaro",
  "lime","lemon","grapefruit","orgeat","honey","falernum","bitters","grenadine","syrup"
];

export const CATEGORY_RULES: Record<string, string[]> = {
  "base-spirit": ["gin","vodka","rum","tequila","whiskey","bourbon","rye","cognac"],
  "citrus": ["lime","lemon"],
  "bitter": ["campari","cynar"]
};
